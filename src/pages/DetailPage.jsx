import React, { useState, useEffect, useMemo } from "react";
import { useWeather } from "../context/WeatherContext";
import { HourlyCompareChart, HourlyRainChart, DailyTempChart, DailyRainChart, DailyConditionCard } from "../components/WeatherCharts";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { PullIndicator, RefreshToast } from "../components/PullToRefreshUI";

const FAV_KEY = "favorites_locations_v1";

// KMA { current, forecast } → 차트가 요구하는 포맷으로 변환
function buildChartData(kmaData) {
  if (!kmaData) return null;
  const { current, forecast = [] } = kmaData;

  // hourSlots: 현재 시각부터 24시간
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  const hourSlots = Array.from({ length: 24 }, (_, i) => {
    const t = new Date(base.getTime() + i * 3600 * 1000);
    return { hour: t.getHours(), timestamp: t.getTime(), label: i === 0 ? "지금" : `${t.getHours()}시`, isMidnight: t.getHours() === 0 };
  });

  // alignedHourly.kma: forecast → 24슬롯 정렬
  const kmaSlots = Array(24).fill(null);
  const startMs = hourSlots[0].timestamp;
  forecast.forEach(f => {
    let idx;
    if (f.isoTime) {
      idx = Math.round((new Date(f.isoTime).getTime() - startMs) / 3600000);
    } else if (f.timeLabel) {
      const fh = parseInt(String(f.timeLabel).split(":")[0], 10);
      idx = (fh - hourSlots[0].hour + 24) % 24;
    }
    if (idx >= 0 && idx < 24 && !kmaSlots[idx]) kmaSlots[idx] = f;
  });

  // 슬롯 0에 실측값 덮어쓰기 (현재 위치와 동일한 방식)
  if (current) {
    const base0 = kmaSlots[0] ?? {};
    kmaSlots[0] = {
      ...base0,
      temp: current.temp,
      humidity: current.humidity,
      wind: current.wind,
      rainChance: current.rainChance ?? base0.rainChance ?? 0,
      condition: current.condition ?? base0.condition,
      timeLabel: base0.timeLabel ?? `${String(now.getHours()).padStart(2, "0")}:00`,
      precipitation: base0.precipitation ?? 0,
    };
  }

  // forward-fill 빈 슬롯
  const filled = [...kmaSlots];
  let last = null;
  for (let i = 0; i < filled.length; i++) {
    if (filled[i]) last = filled[i];
    else if (last) filled[i] = { ...last, _filled: true };
  }
  if (!filled[0]) {
    const first = filled.find(v => v);
    if (first) for (let i = 0; i < filled.length && !filled[i]; i++) filled[i] = { ...first, _filled: true };
  }

  const alignedHourly = {
    kma: filled,
    ow: Array(24).fill(null),
    meteo: Array(24).fill(null),
    wapi: Array(24).fill(null),
  };

  // dailyForecasts: 오늘 제외 날짜별 집계
  const todayLabel = new Date().toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
  const byDate = {};
  forecast.forEach(f => {
    if (f.dateLabel === todayLabel) return;
    if (!byDate[f.dateLabel]) byDate[f.dateLabel] = { tmps: [], conditions: [], rainChances: [], max: null, min: null };
    const d = byDate[f.dateLabel];
    if (f.officialTMX != null && d.max == null) d.max = f.officialTMX;
    if (f.officialTMN != null && d.min == null) d.min = f.officialTMN;
    if (f.temp != null) d.tmps.push(f.temp);
    if (f.condition) d.conditions.push(f.condition);
    d.rainChances.push(f.rainChance ?? 0);
  });
  const dailyForecasts = Object.entries(byDate)
    .map(([date, v]) => ({
      date,
      max: v.max ?? (v.tmps.length ? Math.max(...v.tmps) : null),
      min: v.min ?? (v.tmps.length ? Math.min(...v.tmps) : null),
      rainChance: Math.max(...v.rainChances),
      condition: v.conditions[Math.floor(v.conditions.length / 2)] ?? null,
    }))
    .filter(d => d.max != null && d.min != null)
    .slice(0, 5);

  // weather 객체 (차트 범례·기준값용)
  const weather = current ? {
    condition: current.condition,
    temp: Number(current.temp),
    feelsLike: Number(current.feelsLike ?? current.temp),
    high: Number(current.high ?? current.temp),
    low: Number(current.low ?? current.temp),
    rainChance: current.rainChance ?? 0,
    humidity: current.humidity ?? 0,
    wind: current.wind ?? 0,
  } : null;

  return { hourSlots, alignedHourly, dailyForecasts, weather };
}

// 현재위치/관심지역 공통 차트 레이아웃
function ChartLayout({ hourSlots, alignedHourly, weather, compareWeather, meteoWeather, wapiWeather, dailyForecasts, owDailyForecasts, wapiDailyForecasts, theme }) {
  return (
    <div className="px-4 pb-32 space-y-3">
      <div className="rounded-3xl p-4" style={{ background: theme.card }}>
        <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>시간대별 온도</p>
        <HourlyCompareChart
          alignedHourly={alignedHourly}
          hourSlots={hourSlots}
          weather={weather}
          compareWeather={compareWeather}
          meteoWeather={meteoWeather}
          wapiWeather={wapiWeather}
          theme={theme}
        />
      </div>

      <div className="rounded-3xl p-4" style={{ background: theme.card }}>
        <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>시간대별 강수확률</p>
        <HourlyRainChart alignedHourly={alignedHourly} hourSlots={hourSlots} theme={theme} />
      </div>

      <div className="rounded-3xl p-4" style={{ background: theme.card }}>
        <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>5일 기온</p>
        <DailyTempChart
          dailyForecasts={dailyForecasts}
          owDailyForecasts={owDailyForecasts ?? []}
          meteoDaily={meteoWeather?.daily}
          wapiDailyForecasts={wapiDailyForecasts ?? []}
          theme={theme}
        />
      </div>

      <div className="rounded-3xl p-4" style={{ background: theme.card }}>
        <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>5일 강수확률</p>
        <DailyRainChart
          dailyForecasts={dailyForecasts}
          owDailyForecasts={owDailyForecasts ?? []}
          meteoDaily={meteoWeather?.daily}
          wapiDailyForecasts={wapiDailyForecasts ?? []}
          theme={theme}
        />
      </div>

      <div className="rounded-3xl p-4" style={{ background: theme.card }}>
        <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>5일 날씨</p>
        <DailyConditionCard
          dailyForecasts={dailyForecasts}
          owDailyForecasts={owDailyForecasts ?? []}
          meteoDaily={meteoWeather?.daily}
          wapiDailyForecasts={wapiDailyForecasts ?? []}
          theme={theme}
        />
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
  const [favWeather, setFavWeather] = useState(null);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    if (!selectedId) { setFavWeather(null); return; }
    const fav = favorites.find(f => f.id === selectedId);
    if (!fav) return;
    setFavLoading(true);
    fetch(`/api/kma?lat=${fav.lat}&lon=${fav.lng}`)
      .then(r => r.json())
      .then(data => setFavWeather(data))
      .catch(() => setFavWeather(null))
      .finally(() => setFavLoading(false));
  }, [selectedId]);

  const favChartData = useMemo(() => buildChartData(favWeather), [favWeather]);

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
    <div className={`flex-1 bg-gradient-to-b ${theme.bg} relative overflow-hidden`}
      style={{ fontFamily: "Inter, sans-serif" }}>
      <RefreshToast show={showToast} />
      <div ref={scrollRef} className="absolute inset-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <PullIndicator pullDist={pullDist} PULL_THRESHOLD={PULL_THRESHOLD} />

        {/* 헤더 */}
        <div className="px-6 pt-10 pb-4">
          <p className="text-xs mb-1" style={{ color: theme.sub }}>상세 예보</p>
          <h1 className="text-xl font-bold" style={{ color: theme.text }}>{activeName}</h1>
        </div>

        {/* 지역 선택 버튼 */}
        {favorites.length > 0 && (
          <div style={{ overflowX: "auto", scrollbarWidth: "none", paddingLeft: 16, paddingRight: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, minWidth: "max-content" }}>
              <button
                onClick={() => setSelectedId(null)}
                style={{
                  padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                  background: selectedId === null ? "#3B82F6" : "rgba(0,0,0,0.06)",
                  color: selectedId === null ? "#fff" : theme.sub,
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                <span style={{ fontSize: 11 }}>📍</span>
                {displayLocation}
              </button>

              {favorites.map(fav => (
                <button
                  key={fav.id}
                  onClick={() => setSelectedId(fav.id)}
                  style={{
                    padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                    background: selectedId === fav.id ? "#3B82F6" : "rgba(0,0,0,0.06)",
                    color: selectedId === fav.id ? "#fff" : theme.sub,
                  }}
                >
                  {fav.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 콘텐츠 */}
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
              compareWeather={null}
              meteoWeather={null}
              wapiWeather={null}
              dailyForecasts={favChartData.dailyForecasts}
              owDailyForecasts={[]}
              wapiDailyForecasts={[]}
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
