import React, { useState, useEffect } from "react";
import { useWeather } from "../context/WeatherContext";
import { HourlyCompareChart, HourlyRainChart, DailyTempChart, DailyRainChart, DailyConditionCard } from "../components/WeatherCharts";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { PullIndicator, RefreshToast } from "../components/PullToRefreshUI";

const FAV_KEY = "favorites_locations_v1";

function conditionToEmoji(condition) {
  if (!condition) return "🌡️";
  const c = condition;
  if (c.includes("뇌우")) return "⛈️";
  if (c.includes("눈") && c.includes("비")) return "🌨️";
  if (c.includes("눈")) return "❄️";
  if (c.includes("소나기")) return "🌦️";
  if (c.includes("비")) return "🌧️";
  if (c.includes("이슬비") || c.includes("안개비")) return "🌦️";
  if (c.includes("안개")) return "🌫️";
  if (c.includes("황사") || c.includes("먼지")) return "🌪️";
  if (c.includes("구름많음") || c.includes("흐림")) return "☁️";
  if (c.includes("구름조금") || c.includes("구름")) return "⛅";
  if (c.includes("맑음")) return "☀️";
  return "🌡️";
}

// 관심지역 KMA 데이터 → 시간별/일별 단순 뷰
function FavDetailView({ weather, theme }) {
  const cur = weather?.current;
  const forecast = weather?.forecast ?? [];

  const dailyMap = {};
  forecast.forEach(f => {
    if (!dailyMap[f.dateLabel]) dailyMap[f.dateLabel] = [];
    dailyMap[f.dateLabel].push(f);
  });
  const dailyEntries = Object.entries(dailyMap).slice(0, 5);
  const hourlySlots = forecast.slice(0, 24);

  return (
    <div className="px-4 pb-32 space-y-3">
      {/* 현재 날씨 요약 */}
      {cur && (
        <div className="rounded-3xl p-4" style={{ background: theme.card }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: 52, fontWeight: 800, color: theme.text, lineHeight: 1 }}>
                {Number(cur.temp).toFixed(1)}°
              </span>
              <p style={{ fontSize: 14, color: theme.sub, marginTop: 4 }}>
                {conditionToEmoji(cur.condition)} {cur.condition}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>
                최고 {Number(cur.high).toFixed(1)}° / 최저 {Number(cur.low).toFixed(1)}°
              </p>
              <p style={{ fontSize: 12, color: theme.sub, marginTop: 4 }}>체감 {Number(cur.feelsLike).toFixed(1)}°</p>
              <p style={{ fontSize: 12, color: theme.sub, marginTop: 2 }}>강수 {cur.rainChance}% · 습도 {cur.humidity}%</p>
              <p style={{ fontSize: 12, color: theme.sub, marginTop: 2 }}>바람 {Number(cur.wind).toFixed(1)}m/s</p>
            </div>
          </div>
        </div>
      )}

      {/* 시간별 예보 */}
      {hourlySlots.length > 0 && (
        <div className="rounded-3xl p-4" style={{ background: theme.card }}>
          <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>시간별 예보</p>
          <div style={{ overflowX: "auto", scrollbarWidth: "none" }}>
            <div style={{ display: "flex", gap: 14, minWidth: "max-content" }}>
              {hourlySlots.map((f, i) => (
                <div key={i} style={{ textAlign: "center", minWidth: 44 }}>
                  <p style={{ fontSize: 11, color: theme.sub, marginBottom: 6 }}>{f.timeLabel}</p>
                  <p style={{ fontSize: 18, marginBottom: 4 }}>{conditionToEmoji(f.condition)}</p>
                  <p style={{ fontSize: 14, fontWeight: 800, color: theme.text }}>{f.temp != null ? `${Number(f.temp).toFixed(0)}°` : "—"}</p>
                  <p style={{ fontSize: 10, color: "#3B82F6", marginTop: 4 }}>{f.rainChance}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 일별 예보 */}
      {dailyEntries.length > 0 && (
        <div className="rounded-3xl p-4" style={{ background: theme.card }}>
          <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>일별 예보</p>
          {dailyEntries.map(([dateLabel, slots], i) => {
            const temps = slots.map(s => s.temp).filter(v => v != null);
            const maxTemp = slots[0]?.officialTMX ?? (temps.length ? Math.max(...temps) : null);
            const minTemp = slots[0]?.officialTMN ?? (temps.length ? Math.min(...temps) : null);
            const rainMax = Math.max(...slots.map(s => s.rainChance ?? 0));
            const cond = slots[Math.floor(slots.length / 2)]?.condition ?? "";
            return (
              <div key={dateLabel} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: i < dailyEntries.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
              }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: theme.text, width: 100 }}>{dateLabel}</p>
                <p style={{ fontSize: 20, flex: 1, textAlign: "center" }}>{conditionToEmoji(cond)}</p>
                <p style={{ fontSize: 11, color: "#3B82F6", width: 36, textAlign: "right" }}>{rainMax}%</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: theme.text, width: 80, textAlign: "right" }}>
                  {minTemp != null ? `${Number(minTemp).toFixed(0)}°` : "—"} / {maxTemp != null ? `${Number(maxTemp).toFixed(0)}°` : "—"}
                </p>
              </div>
            );
          })}
        </div>
      )}
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

  const [selectedId, setSelectedId] = useState(null); // null = 현재위치
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
              {/* 현재위치 */}
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

              {/* 관심지역들 */}
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
          ) : (
            <FavDetailView weather={favWeather} theme={theme} />
          )
        ) : (
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
              <HourlyRainChart
                alignedHourly={alignedHourly}
                hourSlots={hourSlots}
                theme={theme}
              />
            </div>

            <div className="rounded-3xl p-4" style={{ background: theme.card }}>
              <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>5일 기온</p>
              <DailyTempChart
                dailyForecasts={dailyForecasts}
                owDailyForecasts={owDailyForecasts}
                meteoDaily={meteoWeather?.daily}
                wapiDailyForecasts={wapiDailyForecasts}
                theme={theme}
              />
            </div>

            <div className="rounded-3xl p-4" style={{ background: theme.card }}>
              <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>5일 강수확률</p>
              <DailyRainChart
                dailyForecasts={dailyForecasts}
                owDailyForecasts={owDailyForecasts}
                meteoDaily={meteoWeather?.daily}
                wapiDailyForecasts={wapiDailyForecasts}
                theme={theme}
              />
            </div>

            <div className="rounded-3xl p-4" style={{ background: theme.card }}>
              <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>5일 날씨</p>
              <DailyConditionCard
                dailyForecasts={dailyForecasts}
                owDailyForecasts={owDailyForecasts}
                meteoDaily={meteoWeather?.daily}
                wapiDailyForecasts={wapiDailyForecasts}
                theme={theme}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
