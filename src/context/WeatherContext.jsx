import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCATION, getTheme, getSpeech, isKorea } from "../utils/weather";
import { fetchOpenMeteo } from "../utils/openmeteo-client";

// 날씨 상태값 우선순위 (낮을수록 심각, 1-4=비, 5-7=흐림, 8=맑음)
const COND_PRIORITY = {
  "뇌우": 1, "천둥번개": 1,
  "눈소나기": 2, "소나기": 2,
  "비": 3, "비/눈": 3, "눈/비": 3, "눈": 3,
  "이슬비": 4,
  "안개": 5,
  "흐림": 6,
  "구름많음": 7,
  "맑음": 8,
};

function pickCondition(conditions) {
  const valid = (conditions || []).filter(c => c != null && COND_PRIORITY[c] != null);
  if (!valid.length) return null;
  return valid.reduce((best, c) => COND_PRIORITY[c] < COND_PRIORITY[best] ? c : best);
}

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
  const [midForecast, setMidForecast] = useState([]);
  const [weatherHistory, setWeatherHistory] = useState([]);
  const [airForecast, setAirForecast] = useState({ airkorea: [], openmeteo: [], openmeteoHourly: [] });

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
    // 5일 미세먼지 예보
    fetch(`/api/air-forecast?lat=${lat}&lon=${lon}`)
      .then(r => r.json())
      .then(d => { if (d && !d.error) setAirForecast(d); })
      .catch(() => {});
  };

  // force=true 이면 KV 캐시 무시하고 기상청 직접 호출
  const requestCurrentLocation = (force = false) => {
    const fallback = () => {
      setCoords(DEFAULT_LOCATION);
      fetchWeatherData(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon, force);
      fetchAir(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
    };
    if (!navigator.geolocation) { fallback(); return; }

    // geolocation이 콜백을 아예 안 부르는 환경 대비 — 10초 후 강제 폴백
    const geoTimer = setTimeout(fallback, 10000);
    let settled = false;
    const settle = (fn) => { if (settled) return; settled = true; clearTimeout(geoTimer); fn(); };

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        settle(() => {
          setCoords({ lat, lon });
          reverseGeocode(lat, lon).then(name => setDisplayLocation(name));
          fetchWeatherData(lat, lon, force);
          fetchAir(lat, lon);
        });
      },
      () => settle(fallback),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 600000 }
    );
  };

  // fetch with 12s timeout — hanging API calls never block the UI
  const fetchWithTimeout = (url, ms = 12000) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
  };

  const fetchWeatherData = async (lat, lon, force = false) => {
    try {
      setLoading(true);
      setError("");
      setCompareWeather(null);
      const korea = isKorea(lat, lon);
      const forceParam = force ? "&force=1" : "";

      if (korea) {
        // 기상청만 blocking — 나머지는 loading 종료 후 백그라운드
        const kmaRes = await fetchWithTimeout(`/api/kma?lat=${lat}&lon=${lon}${forceParam}`, 15000)
          .catch(e => ({ ok: false, _err: e.message }));

        if (!kmaRes.ok) {
          throw new Error(kmaRes._err || "기상청 API 오류");
        }
        const data = await kmaRes.json();
        setCurrentWeather(data.current);
        setWeatherSource("기상청");

        // 보조 소스 — 백그라운드 (실패해도 무시)
        fetchOpenMeteo(lat, lon)
          .then(meteoData => {
            setMeteoWeather(meteoData);
            setMeteoForecast(meteoData.forecast || []);
            if (meteoData.air) setAirMeteo(meteoData.air);
          }).catch(() => {});

        fetchWithTimeout(`/api/weatherapi?lat=${lat}&lon=${lon}`, 20000)
          .then(r => r.ok ? r.json() : null).then(wapiData => {
            if (!wapiData || wapiData.error) return;
            setWapiWeather(wapiData.current);
            setWapiForecast(wapiData.forecast || []);
            setWapiDailyForecasts(wapiData.daily || []);
            if (wapiData.air) setAirWapi(wapiData.air);
          }).catch(() => {});

        fetchWithTimeout(`/api/openweather?lat=${lat}&lon=${lon}`, 20000)
          .then(r => r.ok ? r.json() : null)
          .then(owData => {
            if (!owData) return;
            // current.high/low는 buildCurrent에서 daily 데이터 기반으로 이미 올바르게 설정됨
            const owCurrent = { ...owData.current };
            setCompareWeather(owCurrent);
            const owDailyMap = {};
            (owData.forecast || []).forEach(f => {
              const key = f.dateLabel;
              if (!owDailyMap[key]) owDailyMap[key] = { tempMins: [], tempMaxs: [], rainChances: [], conditions: [], condAm: null, condPm: null };
              owDailyMap[key].tempMins.push(f.tempMin ?? f.temp);
              owDailyMap[key].tempMaxs.push(f.tempMax ?? f.temp);
              owDailyMap[key].rainChances.push(f.rainChance ?? 0);
              owDailyMap[key].conditions.push(f.condition);
              const hour = parseInt(String(f.timeLabel).split(":")[0], 10);
              if (hour === 9)  owDailyMap[key].condAm = f.condition;
              if (hour === 15) owDailyMap[key].condPm = f.condition;
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
                  condAm: v.condAm,
                  condPm: v.condPm,
                }))
                .slice(0, 5)
            );
            // ECMWF 데이터는 1시간 간격으로 자정(00:00 KST)부터 시작
            // 현재 시각부터 24시간치를 가져와야 올바른 시간대 온도가 표시됨
            const nowHour = new Date().getHours();
            setOwForecast((owData.forecast || []).slice(nowHour, nowHour + 24).map(f => ({
              timeLabel:     f.timeLabel,
              isoTime:       f.isoTime,
              temp:          f.temp,
              rainChance:    f.rainChance,
              condition:     f.condition,
              humidity:      f.humidity      ?? 0,
              wind:          f.wind          ?? 0,
              precipitation: f.precipitation ?? 0,
            })));
          })
          .catch(() => {});

        // 이력 조회 (비동기 — 실패해도 무시)
        fetch(`/api/kma-history?lat=${lat}&lon=${lon}`)
          .then(r => r.json())
          .then(d => {
            if (Array.isArray(d)) {
              setWeatherHistory(d.sort((a, b) => b.savedAt - a.savedAt));
            }
          })
          .catch(() => {});

        setForecast(data.forecast || []);
        setMidForecast([]); // 초기화

        // 중기예보는 별도 state로 보관 — dailyForecasts useMemo에서 합산
        fetch(`/api/kma-mid?lat=${lat}&lon=${lon}`)
          .then(r => r.ok ? r.json() : null)
          .then(midData => {
            if (midData?.forecast?.length) setMidForecast(midData.forecast);
          })
          .catch(() => {});
      } else {
        const res = await fetch(`/api/openweather?lat=${lat}&lon=${lon}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `날씨 API 오류 (${res.status})`);
        }
        const data = await res.json();
        setCurrentWeather(data.current);
        setForecast(data.forecast);
        setWeatherSource("ECMWF");
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
      wapi:  fillGaps(alignForecast(wapiForecast)),
    };
  }, [currentWeather, todayForecasts, owForecast, meteoForecast, wapiForecast, hourSlots]);

  const dailyForecasts = useMemo(() => {
    const todayLabel = new Date().toLocaleDateString("ko-KR", {
      month: "numeric", day: "numeric", weekday: "short",
    });

    // ── 단기예보에서 날짜별 일별 요약 추출 ──────────────────────────────────
    // officialTMX/TMN은 fcstDate별로 동일한 값이 모든 시간 슬롯에 있음
    const shortByDate = {};
    forecast.forEach((item) => {
      const key = item.dateLabel;
      if (key === todayLabel) return;
      if (!shortByDate[key]) {
        shortByDate[key] = { date: key, max: null, min: null, rainChance: 0, tmps: [], conditions: [], conditionsAm: [], conditionsPm: [] };
      }
      const d = shortByDate[key];
      // officialTMX/TMN — 이미 per-date로 정확하므로 한 번만 세팅하면 됨
      if (item.officialTMX != null && d.max == null) d.max = item.officialTMX;
      if (item.officialTMN != null && d.min == null) d.min = item.officialTMN;
      d.rainChance = Math.max(d.rainChance, item.rainChance ?? 0);
      if (item.temp != null) d.tmps.push(item.temp);
      if (item.condition) {
        const hour = item.isoTime ? new Date(item.isoTime).getHours() : -1;
        if (hour === -1 || (hour >= 9 && hour <= 18)) d.conditions.push(item.condition);
        if (hour >= 6 && hour < 12) d.conditionsAm.push(item.condition);
        else if (hour >= 12 && hour <= 18) d.conditionsPm.push(item.condition);
      }
    });

    // 단기예보 날짜 목록 (오늘 제외, 삽입 순서 = 시간 순)
    // max == min 인 날(TMX/TMN 미수록 + 슬롯 부족)은 제외 → midForecast로 gap-fill
    const shortDays = Object.values(shortByDate).map(({ tmps, conditions, conditionsAm, conditionsPm, ...d }) => ({
      ...d,
      max: d.max ?? (tmps.length ? Math.max(...tmps) : null),
      min: d.min ?? (tmps.length ? Math.min(...tmps) : null),
      condition: pickCondition(conditions),
      condAm: pickCondition(conditionsAm),
      condPm: pickCondition(conditionsPm),
    })).filter(d => d.max != null && d.min != null && d.max > d.min);
    const shortDates = new Set(shortDays.map(d => d.date));

    // ── 중기예보 — 단기가 이미 커버하는 날짜 제외 ───────────────────────────
    const midDays = midForecast
      .filter(f => f.dateLabel !== todayLabel && !shortDates.has(f.dateLabel))
      .map(f => ({
        date:       f.dateLabel,
        max:        f.tempMax  ?? null,
        min:        f.tempMin  ?? null,
        rainChance: f.rainChance ?? 0,
        condition:  f.condition  ?? null,
        condAm:     f.condAm    ?? null,
        condPm:     f.condPm    ?? null,
      }));

    // ── 합산 (단기 → 중기 순서) ──────────────────────────────────────────
    let result = [...shortDays, ...midDays].slice(0, 5);

    // ── 5일 미달이면 KV 이력에서 gap-fill ───────────────────────────────
    if (result.length < 5 && weatherHistory.length > 0) {
      const have = new Set(result.map(d => d.date));
      const latestSnap = weatherHistory.find(h => h.dailySummary?.length >= 2);
      if (latestSnap) {
        const fillers = latestSnap.dailySummary
          .filter(d => !have.has(d.dateLabel) && d.dateLabel !== todayLabel)
          .map(d => ({
            date: d.dateLabel, max: d.max, min: d.min,
            rainChance: d.rainChance, condition: d.condition,
            _fromHistory: true,
          }));
        result = [...result, ...fillers].slice(0, 5);
      }
    }

    return result;
  }, [forecast, midForecast, weatherHistory]);

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
      weatherHistory, forecastHistory, airForecast,
      requestCurrentLocation,
    }}>
      {children}
    </WeatherContext.Provider>
  );
}

export const useWeather = () => useContext(WeatherContext);
