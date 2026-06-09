import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCATION, reverseGeocode, getTheme, getSpeech, isKorea } from "../utils/weather";

const WeatherContext = createContext(null);

export function WeatherProvider({ children }) {
  const [coords, setCoords] = useState(DEFAULT_LOCATION);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [compareWeather, setCompareWeather] = useState(null);
  const [displayLocation, setDisplayLocation] = useState("서울");
  const [weatherSource, setWeatherSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [air, setAir] = useState(null);

  useEffect(() => { requestCurrentLocation(); }, []);

  const fetchAir = (lat, lon) => {
    fetch(`/api/air?lat=${lat}&lon=${lon}`)
      .then(r => r.json())
      .then(d => { if (d && !d.error) setAir(d); })
      .catch(() => {});
  };

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      fetchWeatherData(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
      fetchAir(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setCoords({ lat, lon });
        const name = await reverseGeocode(lat, lon);
        setDisplayLocation(name);
        fetchWeatherData(lat, lon);
        fetchAir(lat, lon);
      },
      () => {
        setCoords(DEFAULT_LOCATION);
        fetchWeatherData(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
        fetchAir(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 600000 }
    );
  };

  const fetchWeatherData = async (lat, lon) => {
    try {
      setLoading(true);
      setError("");
      setCompareWeather(null);
      const korea = isKorea(lat, lon);

      if (korea) {
        const [kmaRes, owRes] = await Promise.allSettled([
          fetch(`/api/kma?lat=${lat}&lon=${lon}`),
          fetch(`/api/openweather?lat=${lat}&lon=${lon}`),
        ]);

        if (kmaRes.status !== "fulfilled" || !kmaRes.value.ok) {
          const body = await kmaRes.value?.json().catch(() => ({}));
          throw new Error(body?.error || "기상청 API 오류");
        }
        const data = await kmaRes.value.json();
        setCurrentWeather(data.current);
        setWeatherSource("기상청");

        if (owRes.status === "fulfilled" && owRes.value.ok) {
          const owData = await owRes.value.json();
          const todayLabel = new Date().toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
          const todayFcst = (owData.forecast || []).filter(f => f.dateLabel === todayLabel);
          const owCurrent = { ...owData.current };
          if (todayFcst.length) {
            owCurrent.high = Math.max(...todayFcst.map(f => f.tempMax ?? f.temp));
            owCurrent.low = Math.min(...todayFcst.map(f => f.tempMin ?? f.temp));
          }
          setCompareWeather(owCurrent);
        }

        const shortForecast = data.forecast || [];
        const shortLabels = new Set(shortForecast.map(f => f.dateLabel));
        const midRes = await fetch(`/api/kma-mid?lat=${lat}&lon=${lon}`).catch(() => null);
        if (midRes?.ok) {
          const midData = await midRes.json();
          const midOnly = (midData.forecast || []).filter(f => !shortLabels.has(f.dateLabel));
          setForecast([...shortForecast, ...midOnly]);
        } else {
          setForecast(shortForecast);
        }
      } else {
        const res = await fetch(`/api/openweather?lat=${lat}&lon=${lon}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `날씨 API 오류 (${res.status})`);
        }
        const data = await res.json();
        setCurrentWeather(data.current);
        setForecast(data.forecast);
        setWeatherSource("OpenWeather");
      }
    } catch (err) {
      setError(err.message || "알 수 없는 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  };

  const theme = useMemo(() => getTheme(currentWeather?.condition), [currentWeather]);

  const weather = useMemo(() => {
    if (!currentWeather) return null;
    return {
      condition: currentWeather.condition || "날씨 정보 없음",
      temp: Math.round(currentWeather.temp),
      feelsLike: Math.round(currentWeather.feelsLike ?? currentWeather.temp),
      high: Math.round(currentWeather.high ?? currentWeather.temp),
      low: Math.round(currentWeather.low ?? currentWeather.temp),
      rainChance: currentWeather.rainChance ?? 0,
      humidity: currentWeather.humidity ?? 0,
      wind: currentWeather.wind ?? 0,
      observedAt: currentWeather.observedAt ?? null,
    };
  }, [currentWeather]);

  const speech = getSpeech(theme, weather);

  const todayForecasts = useMemo(() => forecast.slice(0, 6), [forecast]);

  const dailyForecasts = useMemo(() => {
    const todayLabel = new Date().toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
    const grouped = {};
    forecast.forEach((item) => {
      const key = item.dateLabel;
      if (key === todayLabel) return;
      if (!grouped[key]) {
        grouped[key] = { date: key, min: item.tempMin, max: item.tempMax, rainChance: item.rainChance ?? 0, tmps: [item.temp] };
      } else {
        if (item.tempMin != null) grouped[key].min = grouped[key].min == null ? item.tempMin : Math.min(grouped[key].min, item.tempMin);
        if (item.tempMax != null) grouped[key].max = grouped[key].max == null ? item.tempMax : Math.max(grouped[key].max, item.tempMax);
        grouped[key].rainChance = Math.max(grouped[key].rainChance, item.rainChance ?? 0);
        grouped[key].tmps.push(item.temp);
      }
    });
    return Object.values(grouped).slice(0, 5).map(({ tmps, min, max, ...rest }) => ({
      ...rest,
      min: min ?? Math.min(...tmps),
      max: max ?? Math.max(...tmps),
    }));
  }, [forecast]);

  return (
    <WeatherContext.Provider value={{
      coords, currentWeather, weather, forecast, todayForecasts, dailyForecasts,
      compareWeather, displayLocation, weatherSource, loading, error, air, theme, speech,
      requestCurrentLocation,
    }}>
      {children}
    </WeatherContext.Provider>
  );
}

export const useWeather = () => useContext(WeatherContext);
