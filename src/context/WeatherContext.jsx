import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCATION, getTheme, getSpeech, isKorea } from "../utils/weather";

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(`/api/geocode?lat=${lat}&lon=${lon}&_=${Date.now()}`);
    const data = await res.json();
    return data.name || "현재 위치";
  } catch {
    return "현재 위치";
  }
}

const WeatherContext = createContext(null);

export function WeatherProvider({ children }) {
  const [coords, setCoords] = useState(DEFAULT_LOCATION);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [compareWeather, setCompareWeather] = useState(null);
  const [meteoWeather, setMeteoWeather] = useState(null);
  const [owForecast, setOwForecast] = useState([]);
  const [owDailyForecasts, setOwDailyForecasts] = useState([]);
  const [meteoForecast, setMeteoForecast] = useState([]);
  const [wapiWeather, setWapiWeather] = useState(null);
  const [wapiForecast, setWapiForecast] = useState([]);
  const [wapiDailyForecasts, setWapiDailyForecasts] = useState([]);
  const [airWapi, setAirWapi] = useState(null);
  const [displayLocation, setDisplayLocation] = useState("서울");
  const [weatherSource, setWeatherSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [air, setAir] = useState(null);
  const [airOw, setAirOw] = useState(null);
  const [airMeteo, setAirMeteo] = useState(null);
  const [weatherHistory, setWeatherHistory] = useState([]);

  useEffect(() => { requestCurrentLocation(); }, []);

  const fetchAir = (lat, lon) => {
    // 에어코리아
    fetch(`/api/air?lat=${lat}&lon=${lon}`)
      .then(r => r.json())
      .then(d => { if (d && !d.error) setAir(d); })
      .catch(() => {});
    // OpenWeather 대기오염 (비교용)
    fetch(`/api/air-ow?lat=${lat}&lon=${lon}`)
      .then(r => r.json())
      .then(d => { if (d && !d.error) setAirOw(d); })
      .catch(() => {});
  };

  // force=true 이면 KV 캐시 무시하고 기상청 직접 호출
  const requestCurrentLocation = (force = false) => {
    if (!navigator.geolocation) {
      fetchWeatherData(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon, force);
      fetchAir(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setCoords({ lat, lon });
        const name = await reverseGeocode(lat, lon);
        setDisplayLocation(name);
        fetchWeatherData(lat, lon, force);
        fetchAir(lat, lon);
      },
      () => {
        setCoords(DEFAULT_LOCATION);
        fetchWeatherData(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon, force);
        fetchAir(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 600000 }
    );
  };

  const fetchWeatherData = async (lat, lon, force = false) => {
    try {
      setLoading(true);
      setError("");
      setCompareWeather(null);
      const korea = isKorea(lat, lon);
      const forceParam = force ? "&force=1" : "";

      if (korea) {
        const [kmaRes, owRes, meteoRes, wapiRes] = await Promise.allSettled([
          fetch(`/api/kma?lat=${lat}&lon=${lon}${forceParam}`),
          fetch(`/api/openweather?lat=${lat}&lon=${lon}`),
          fetch(`/api/openmeteo?lat=${lat}&lon=${lon}`),
          fetch(`/api/weatherapi?lat=${lat}&lon=${lon}`),
        ]);

        if (kmaRes.status !== "fulfilled" || !kmaRes.value.ok) {
          const body = await kmaRes.value?.json().catch(() => ({}));
          throw new Error(body?.error || "기상청 API 오류");
        }
        const data = await kmaRes.value.json();
        setCurrentWeather(data.current);
        setWeatherSource("기상청");

        if (meteoRes.status === "fulfilled" && meteoRes.value.ok) {
          const meteoData = await meteoRes.value.json();
          if (!meteoData.error) {
            setMeteoWeather(meteoData);
            setMeteoForecast(meteoData.forecast || []);
            if (meteoData.air) setAirMeteo(meteoData.air);
          }
        }

        if (wapiRes.status === "fulfilled" && wapiRes.value.ok) {
          const wapiData = await wapiRes.value.json();
          if (!wapiData.error) {
            setWapiWeather(wapiData.current);
            setWapiForecast(wapiData.forecast || []);
            setWapiDailyForecasts(wapiData.daily || []);
            if (wapiData.air) setAirWapi(wapiData.air);
          }
        }

        if (owRes.status === "fulfilled" && owRes.value.ok) {
          const owData = await owRes.value.json();
          const next24 = (owData.forecast || []).slice(0, 8);
          const owCurrent = { ...owData.current };
          if (next24.length) {
            owCurrent.high = Math.max(...next24.map(f => f.tempMax ?? f.temp));
            owCurrent.low  = Math.min(...next24.map(f => f.tempMin ?? f.temp));
          }
          setCompareWeather(owCurrent);

          // OW 일별 집계 (전체 40개 아이템 → 날짜별 min/max/rainChance)
          const owDailyMap = {};
          (owData.forecast || []).forEach(f => {
            const key = f.dateLabel;
            if (!owDailyMap[key]) owDailyMap[key] = { tempMins: [], tempMaxs: [], rainChances: [], conditions: [] };
            owDailyMap[key].tempMins.push(f.tempMin ?? f.temp);
            owDailyMap[key].tempMaxs.push(f.tempMax ?? f.temp);
            owDailyMap[key].rainChances.push(f.rainChance ?? 0);
            owDailyMap[key].conditions.push(f.condition);
          });
          const todayLbl = new Date().toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
          setOwDailyForecasts(
            Object.entries(owDailyMap)
              .filter(([date]) => date !== todayLbl)
              .map(([date, v]) => ({
                date,
                min: Math.min(...v.tempMins),
                max: Math.max(...v.tempMaxs),
                rainChance: Math.max(...v.rainChances),
                condition: v.conditions[Math.floor(v.conditions.length / 2)],
              }))
              .slice(0, 5)
          );

          // OW 시간별 예보 저장 (다음 8슬롯)
          setOwForecast((owData.forecast || []).slice(0, 8).map(f => ({
            timeLabel:     f.timeLabel,
            temp:          f.temp,
            rainChance:    f.rainChance,
            condition:     f.condition,
            humidity:      f.humidity      ?? 0,
            wind:          f.wind          ?? 0,
            precipitation: f.precipitation ?? 0,
          })));
        }

        // 이력 조회 (비동기 — 실패해도 무시)
        fetch(`/api/kma-history?lat=${lat}&lon=${lon}`)
          .then(r => r.json())
          .then(d => {
            if (Array.isArray(d)) {
              setWeatherHistory(d.sort((a, b) => b.savedAt - a.savedAt));
            }
          })
          .catch(() => {});

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
      temp: Number(currentWeather.temp),
      feelsLike: Number(currentWeather.feelsLike ?? currentWeather.temp),
      high: Number(currentWeather.high ?? currentWeather.temp),
      low: Number(currentWeather.low ?? currentWeather.temp),
      rainChance: currentWeather.rainChance ?? 0,
      humidity: currentWeather.humidity ?? 0,
      wind: currentWeather.wind ?? 0,
      observedAt: currentWeather.observedAt ?? null,
    };
  }, [currentWeather]);

  const speech = getSpeech(theme, weather);

  // 24시간 공통 시간축 (현재시 ~ +23시) — 모든 기관 비교용
  const hourSlots = useMemo(() => {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);
    return Array.from({ length: 24 }, (_, i) => {
      const t = new Date(base.getTime() + i * 3600 * 1000);
      return {
        hour:      t.getHours(),
        timestamp: t.getTime(),          // ← 날짜 경계 처리용 절대 ms
        label:     i === 0 ? "지금" : `${t.getHours()}시`,
        isMidnight: t.getHours() === 0,
      };
    });
  }, [currentWeather]);

  // KMA forecast: isoTime 기반으로 현재 24h 윈도우 정확히 필터
  const todayForecasts = useMemo(() => {
    if (!forecast.length) return [];
    if (forecast[0]?.isoTime) {
      const startMs = hourSlots[0]?.timestamp ?? Date.now();
      const endMs   = startMs + 24 * 3600 * 1000;
      return forecast.filter(f => {
        const t = new Date(f.isoTime).getTime();
        return t >= startMs && t < endMs;
      });
    }
    return forecast.slice(0, 24);
  }, [forecast, hourSlots]);

  const alignForecast = (items) => {
    const slots = Array(24).fill(null);
    if (!items?.length) return slots;
    const startMs = hourSlots[0]?.timestamp;

    items.forEach((f) => {
      if (!f?.timeLabel) return;
      let idx;
      if (f.isoTime && startMs) {
        // isoTime이 있으면 ms 차이로 정확한 슬롯 계산 (날짜 경계 무관)
        idx = Math.round((new Date(f.isoTime).getTime() - startMs) / 3600000);
      } else {
        // OW/Meteo: 시간 기반 폴백
        const fh = parseInt(String(f.timeLabel).split(":")[0], 10);
        if (isNaN(fh)) return;
        idx = (fh - hourSlots[0].hour + 24) % 24;
      }
      if (idx >= 0 && idx < 24 && !slots[idx]) slots[idx] = f;
    });
    return slots;
  };

  // OW(3h)는 빈 슬롯을 직전 예보로 forward-fill (시작이 비면 backfill로 보강)
  const fillGaps = (slots) => {
    const out = [...slots];
    let last = null;
    for (let i = 0; i < out.length; i++) {
      if (out[i]) last = out[i];
      else if (last) out[i] = { ...last, _filled: true };
    }
    if (!out[0]) {
      const firstReal = out.find((v) => v);
      if (firstReal) {
        for (let i = 0; i < out.length && !out[i]; i++) {
          out[i] = { ...firstReal, _filled: true };
        }
      }
    }
    return out;
  };

  const alignedHourly = useMemo(() => {
    const kmaSlots = alignForecast(todayForecasts);
    // 슬롯 0("지금")은 예보값 대신 실측값(초단기실황)으로 덮어쓰기 — 메인 온도와 싱크
    if (currentWeather) {
      const base = kmaSlots[0] ?? {};
      kmaSlots[0] = {
        ...base,
        temp:        currentWeather.temp,
        humidity:    currentWeather.humidity,
        wind:        currentWeather.wind,
        rainChance:  currentWeather.rainChance ?? base.rainChance ?? 0,
        condition:   currentWeather.condition  ?? base.condition,
        timeLabel:   base.timeLabel ?? `${String(new Date().getHours()).padStart(2, "0")}:00`,
        precipitation: base.precipitation ?? 0,
      };
    }
    return {
      kma:   fillGaps(kmaSlots),
      ow:    fillGaps(alignForecast(owForecast)),
      meteo: alignForecast(meteoForecast),
      wapi:  alignForecast(wapiForecast),
    };
  }, [currentWeather, todayForecasts, owForecast, meteoForecast, wapiForecast, hourSlots]);

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
    const base = Object.values(grouped).slice(0, 5).map(({ tmps, min, max, ...rest }) => ({
      ...rest,
      min: min ?? Math.min(...tmps),
      max: max ?? Math.max(...tmps),
    }));

    // ── 오전 빈칸 보완: 5일치가 부족하면 최근 이력 예보에서 gap-fill ──────────
    if (base.length < 5 && weatherHistory.length > 0) {
      const existingDates = new Set(base.map(d => d.date));
      // 예보 포함 이력 중 가장 최신 스냅샷
      const latestWithFcst = weatherHistory.find(h => h.dailySummary?.length >= 2);
      if (latestWithFcst) {
        const fillers = latestWithFcst.dailySummary
          .filter(d => !existingDates.has(d.dateLabel) && d.dateLabel !== todayLabel)
          .map(d => ({ date: d.dateLabel, min: d.min, max: d.max, rainChance: d.rainChance, _fromHistory: true }));
        return [...base, ...fillers].slice(0, 5);
      }
    }
    return base;
  }, [forecast, weatherHistory]);

  // ── 날짜별 최신 예보 스냅샷 (예보 이력 카드용) ───────────────────────────
  const forecastHistory = useMemo(() => {
    if (!weatherHistory.length) return [];
    const byDay = {};
    weatherHistory.forEach(snap => {
      if (!snap.dailySummary?.length) return;
      const d = new Date(snap.savedAt);
      const dayKey = d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
      if (!byDay[dayKey] || snap.savedAt > byDay[dayKey].savedAt) {
        byDay[dayKey] = { ...snap, dayKey };
      }
    });
    return Object.values(byDay)
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, 3);    // 최근 3일
  }, [weatherHistory]);

  return (
    <WeatherContext.Provider value={{
      coords, currentWeather, weather, forecast, todayForecasts, dailyForecasts,
      compareWeather, meteoWeather, owForecast, owDailyForecasts, meteoForecast,
      wapiWeather, wapiForecast, wapiDailyForecasts,
      hourSlots, alignedHourly,
      displayLocation, weatherSource, loading, error, air, airOw, airMeteo, airWapi, theme, speech,
      weatherHistory, forecastHistory,
      requestCurrentLocation,
    }}>
      {children}
    </WeatherContext.Provider>
  );
}

export const useWeather = () => useContext(WeatherContext);
