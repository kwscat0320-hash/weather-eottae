import React, { useState, useEffect, useMemo } from "react";
import { useWeather } from "../context/WeatherContext";
import { fetchOpenMeteo } from "../utils/openmeteo-client";
import { HourlyCompareChart, HourlyRainChart, DailyTempChart, DailyRainChart, DailyConditionCard } from "../components/WeatherCharts";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { PullIndicator, RefreshToast } from "../components/PullToRefreshUI";

const FAV_KEY = "favorites_locations_v1";

// 관심지역의 모든 소스 병렬 fetch
async function fetchAllSources(lat, lng) {
  const [kmaRes, owRes, meteoRes, wapiRes] = await Promise.allSettled([
    fetch(`/api/kma?lat=${lat}&lon=${lng}`).then(r => r.json()),
    fetch(`/api/openweather?lat=${lat}&lon=${lng}`).then(r => r.json()),
    fetchOpenMeteo(lat, lng),
    fetch(`/api/weatherapi?lat=${lat}&lon=${lng}`).then(r => r.json()),
  ]);
  return {
    kma:   kmaRes.status   === "fulfilled" ? kmaRes.value   : null,
    ow:    owRes.status    === "fulfilled" ? owRes.value    : null,
    meteo: meteoRes.status === "fulfilled" ? meteoRes.value : null,
    wapi:  wapiRes.status  === "fulfilled" ? wapiRes.value  : null,
  };
}

// forecast 배열 → 24슬롯 정렬 (WeatherContext의 alignForecast와 동일)
function alignForecast(items, hourSlots) {
  const slots = Array(24).fill(null);
  if (!items?.length) return slots;
  const startMs = hourSlots[0].timestamp;
  items.forEach(f => {
    let idx;
    if (f.isoTime) {
      idx = Math.round((new Date(f.isoTime).getTime() - startMs) / 3600000);
    } else if (f.timeLabel) {
      const fh = parseInt(String(f.timeLabel).split(":")[0], 10);
      idx = (fh - hourSlots[0].hour + 24) % 24;
    }
    if (idx >= 0 && idx < 24 && !slots[idx]) slots[idx] = f;
  });
  return slots;
}

function fillGaps(slots) {
  const out = [...slots];
  let last = null;
  for (let i = 0; i < out.length; i++) {
    if (out[i]) last = out[i];
    else if (last) out[i] = { ...last, _filled: true };
  }
  if (!out[0]) {
    const first = out.find(v => v);
    if (first) for (let i = 0; i < out.length && !out[i]; i++) out[i] = { ...first, _filled: true };
  }
  return out;
}

// 모든 소스 데이터 → 차트 포맷 변환
function buildChartData(sources) {
  if (!sources?.kma) return null;
  const { kma, ow, meteo, wapi } = sources;

  // hourSlots
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  const hourSlots = Array.from({ length: 24 }, (_, i) => {
    const t = new Date(base.getTime() + i * 3600 * 1000);
    return { hour: t.getHours(), timestamp: t.getTime(), label: i === 0 ? "지금" : `${t.getHours()}시`, isMidnight: t.getHours() === 0 };
  });

  // KMA 슬롯 + 슬롯0 실측 덮어쓰기
  const kmaSlots = alignForecast(kma.forecast ?? [], hourSlots);
  if (kma.current) {
    const b = kmaSlots[0] ?? {};
    kmaSlots[0] = { ...b, temp: kma.current.temp, humidity: kma.current.humidity, wind: kma.current.wind, rainChance: kma.current.rainChance ?? b.rainChance ?? 0, condition: kma.current.condition ?? b.condition, timeLabel: b.timeLabel ?? `${String(now.getHours()).padStart(2,"0")}:00`, precipitation: b.precipitation ?? 0 };
  }

  // OW 슬롯 (1시간 간격 — 현재 시각부터 슬라이스)
  const nowHour = now.getHours();
  const owForecastSliced = (ow?.forecast ?? []).slice(nowHour, nowHour + 24).map(f => ({
    timeLabel: f.timeLabel, isoTime: f.isoTime, temp: f.temp,
    rainChance: f.rainChance, condition: f.condition,
    humidity: f.humidity ?? 0, wind: f.wind ?? 0, precipitation: f.precipitation ?? 0,
  }));

  // WeatherAPI 슬롯
  const wapiForecast = wapi?.forecast ?? [];

  // Meteo 슬롯
  const meteoForecast = meteo?.forecast ?? [];

  const alignedHourly = {
    kma:   fillGaps(kmaSlots),
    ow:    fillGaps(alignForecast(owForecastSliced, hourSlots)),
    meteo: alignForecast(meteoForecast, hourSlots),
    wapi:  fillGaps(alignForecast(wapiForecast, hourSlots)),
  };

  // KMA dailyForecasts
  const todayLabel = new Date().toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
  const byDate = {};
  (kma.forecast ?? []).forEach(f => {
    if (f.dateLabel === todayLabel) return;
    if (!byDate[f.dateLabel]) byDate[f.dateLabel] = { tmps: [], conditions: [], rainChances: [], max: null, min: null };
    const d = byDate[f.dateLabel];
    if (f.officialTMX != null && d.max == null) d.max = f.officialTMX;
    if (f.officialTMN != null && d.min == null) d.min = f.officialTMN;
    if (f.temp != null) d.tmps.push(f.temp);
    if (f.condition) d.conditions.push(f.condition);
    d.rainChances.push(f.rainChance ?? 0);
  });
  const dailyForecasts = Object.entries(byDate).map(([date, v]) => ({
    date,
    max: v.max ?? (v.tmps.length ? Math.max(...v.tmps) : null),
    min: v.min ?? (v.tmps.length ? Math.min(...v.tmps) : null),
    rainChance: Math.max(...v.rainChances),
    condition: v.conditions[Math.floor(v.conditions.length / 2)] ?? null,
  })).filter(d => d.max != null && d.min != null).slice(0, 5);

  // OW dailyForecasts
  const owDailyMap = {};
  (ow?.forecast ?? []).forEach(f => {
    if (!owDailyMap[f.dateLabel]) owDailyMap[f.dateLabel] = { tempMins: [], tempMaxs: [], rainChances: [], conditions: [] };
    const d = owDailyMap[f.dateLabel];
    d.tempMins.push(f.tempMin ?? f.temp);
    d.tempMaxs.push(f.tempMax ?? f.temp);
    d.rainChances.push(f.rainChance ?? 0);
    d.conditions.push(f.condition);
  });
  const owDailyForecasts = Object.entries(owDailyMap)
    .filter(([date]) => date !== todayLabel)
    .map(([date, v]) => ({
      date,
      min: Math.min(...v.tempMins),
      max: Math.max(...v.tempMaxs),
      rainChance: Math.max(...v.rainChances),
      condition: v.conditions[Math.floor(v.conditions.length / 2)],
    })).slice(0, 5);

  // WeatherAPI dailyForecasts
  const wapiDailyForecasts = wapi?.daily ?? [];

  // weather 객체
  const weather = kma.current ? {
    condition: kma.current.condition,
    temp: Number(kma.current.temp),
    feelsLike: Number(kma.current.feelsLike ?? kma.current.temp),
    high: Number(kma.current.high ?? kma.current.temp),
    low: Number(kma.current.low ?? kma.current.temp),
    rainChance: kma.current.rainChance ?? 0,
    humidity: kma.current.humidity ?? 0,
    wind: kma.current.wind ?? 0,
  } : null;

  // compare/meteo/wapi current
  const compareWeather = ow?.current ?? null;
  const meteoWeather = meteo ?? null;
  const wapiWeather = wapi?.current ?? null;

  return { hourSlots, alignedHourly, dailyForecasts, owDailyForecasts, wapiDailyForecasts, weather, compareWeather, meteoWeather, wapiWeather };
}

// 공통 차트 레이아웃
function ChartLayout({ hourSlots, alignedHourly, weather, compareWeather, meteoWeather, wapiWeather, dailyForecasts, owDailyForecasts, wapiDailyForecasts, theme }) {
  return (
    <div className="px-4 pb-32 space-y-3">
      <div className="rounded-3xl p-4" style={{ background: theme.card }}>
        <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>시간대별 온도</p>
        <HourlyCompareChart alignedHourly={alignedHourly} hourSlots={hourSlots} weather={weather} compareWeather={compareWeather} meteoWeather={meteoWeather} wapiWeather={wapiWeather} theme={theme} />
      </div>
      <div className="rounded-3xl p-4" style={{ background: theme.card }}>
        <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>시간대별 강수확률</p>
        <HourlyRainChart alignedHourly={alignedHourly} hourSlots={hourSlots} theme={theme} />
      </div>
      <div className="rounded-3xl p-4" style={{ background: theme.card }}>
        <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>5일 기온</p>
        <DailyTempChart dailyForecasts={dailyForecasts} owDailyForecasts={owDailyForecasts ?? []} meteoDaily={meteoWeather?.daily} wapiDailyForecasts={wapiDailyForecasts ?? []} theme={theme} />
      </div>
      <div className="rounded-3xl p-4" style={{ background: theme.card }}>
        <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>5일 강수확률</p>
        <DailyRainChart dailyForecasts={dailyForecasts} owDailyForecasts={owDailyForecasts ?? []} meteoDaily={meteoWeather?.daily} wapiDailyForecasts={wapiDailyForecasts ?? []} theme={theme} />
      </div>
      <div className="rounded-3xl p-4" style={{ background: theme.card }}>
        <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>5일 날씨</p>
        <DailyConditionCard dailyForecasts={dailyForecasts} owDailyForecasts={owDailyForecasts ?? []} meteoDaily={meteoWeather?.daily} wapiDailyForecasts={wapiDailyForecasts ?? []} theme={theme} />
      </div>
    </div>
  );
}

export default function DetailPage({ scrollRef }) {
  const {
    weather, theme, displayLocation, loading,
    compareWeather, meteoWeather, wapiWeather,
    dailyForecasts, owDailyForecasts, wapiDailyForecasts,
    hourSlots, alignedHourly,
    requestCurrentLocation,
  } = useWeather();

  const [favorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; }
    catch { return []; }
  });

  const [selectedId, setSelectedId] = useState(null);
  const [favSources, setFavSources] = useState(null);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    if (!selectedId) { setFavSources(null); return; }
    const fav = favorites.find(f => f.id === selectedId);
    if (!fav) return;
    setFavLoading(true);
    fetchAllSources(fav.lat, fav.lng)
      .then(data => setFavSources(data))
      .catch(() => setFavSources(null))
      .finally(() => setFavLoading(false));
  }, [selectedId]);

  const favChartData = useMemo(() => buildChartData(favSources), [favSources]);

  const handleForceRefresh = () => requestCurrentLocation(true);
  const { pullDist, PULL_THRESHOLD, showToast } = usePullToRefresh(scrollRef, handleForceRefresh, loading);

  const activeName = selectedId
    ? favorites.find(f => f.id === selectedId)?.name ?? ""
    : displayLocation;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: theme?.cardsBg ?? "#f1f5f9" }}>
        <p className="text-sm" style={{ color: theme?.sub }}>데이터 로딩 중...</p>
      </div>
    );
  }

  return (
    <div className={`flex-1 bg-gradient-to-b ${theme.bg} relative overflow-hidden`} style={{ fontFamily: "Inter, sans-serif" }}>
      <RefreshToast show={showToast} />
      <div ref={scrollRef} className="absolute inset-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <PullIndicator pullDist={pullDist} PULL_THRESHOLD={PULL_THRESHOLD} />

        <div className="px-6 pt-10 pb-4">
          <p className="text-xs mb-1" style={{ color: theme.sub }}>상세 예보</p>
          <h1 className="text-xl font-bold" style={{ color: theme.text }}>{activeName}</h1>
        </div>

        {favorites.length > 0 && (
          <div style={{ overflowX: "auto", scrollbarWidth: "none", paddingLeft: 16, paddingRight: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, minWidth: "max-content" }}>
              <button
                onClick={() => setSelectedId(null)}
                style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, flexShrink: 0, background: selectedId === null ? "#3B82F6" : "rgba(0,0,0,0.06)", color: selectedId === null ? "#fff" : theme.sub, display: "flex", alignItems: "center", gap: 5 }}
              >
                <span style={{ fontSize: 11 }}>📍</span>{displayLocation}
              </button>
              {favorites.map(fav => (
                <button
                  key={fav.id}
                  onClick={() => setSelectedId(fav.id)}
                  style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, flexShrink: 0, background: selectedId === fav.id ? "#3B82F6" : "rgba(0,0,0,0.06)", color: selectedId === fav.id ? "#fff" : theme.sub }}
                >
                  {fav.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedId ? (
          favLoading ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <p style={{ fontSize: 13, color: theme.sub }}>날씨 불러오는 중...</p>
            </div>
          ) : favChartData ? (
            <ChartLayout
              hourSlots={favChartData.hourSlots}
              alignedHourly={favChartData.alignedHourly}
              weather={favChartData.weather}
              compareWeather={favChartData.compareWeather}
              meteoWeather={favChartData.meteoWeather}
              wapiWeather={favChartData.wapiWeather}
              dailyForecasts={favChartData.dailyForecasts}
              owDailyForecasts={favChartData.owDailyForecasts}
              wapiDailyForecasts={favChartData.wapiDailyForecasts}
              theme={theme}
            />
          ) : null
        ) : (
          <ChartLayout
            hourSlots={hourSlots}
            alignedHourly={alignedHourly}
            weather={weather}
            compareWeather={compareWeather}
            meteoWeather={meteoWeather}
            wapiWeather={wapiWeather}
            dailyForecasts={dailyForecasts}
            owDailyForecasts={owDailyForecasts}
            wapiDailyForecasts={wapiDailyForecasts}
            theme={theme}
          />
        )}
      </div>
    </div>
  );
}
