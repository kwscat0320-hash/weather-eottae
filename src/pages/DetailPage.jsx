import React from "react";
import { useWeather } from "../context/WeatherContext";
import { HourlyCompareChart, HourlyRainChart, DailyTempChart, DailyRainChart, DailyConditionCard } from "../components/WeatherCharts";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { PullIndicator, RefreshToast } from "../components/PullToRefreshUI";

export default function DetailPage({ scrollRef }) {
  const {
    weather, theme, displayLocation, loading,
    compareWeather, meteoWeather, wapiWeather,
    dailyForecasts, owDailyForecasts, wapiDailyForecasts,
    hourSlots, alignedHourly,
    requestCurrentLocation,
  } = useWeather();

  const handleForceRefresh = () => requestCurrentLocation(true);
  const { pullDist, PULL_THRESHOLD, showToast } = usePullToRefresh(scrollRef, handleForceRefresh, loading);

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
          <h1 className="text-xl font-bold" style={{ color: theme.text }}>{displayLocation}</h1>
        </div>

        <div className="px-4 pb-32 space-y-3">

          {/* 시간대별 온도 */}
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

          {/* 시간대별 강수확률 */}
          <div className="rounded-3xl p-4" style={{ background: theme.card }}>
            <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>시간대별 강수확률</p>
            <HourlyRainChart
              alignedHourly={alignedHourly}
              hourSlots={hourSlots}
              theme={theme}
            />
          </div>

          {/* 5일 기온 */}
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

          {/* 5일 강수확률 */}
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

          {/* 5일 날씨 상태 */}
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
      </div>
    </div>
  );
}
