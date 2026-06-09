import React from "react";
import { useWeather } from "../context/WeatherContext";
import { gradeInfo } from "../utils/weather";

export default function DetailPage() {
  const { weather, compareWeather, theme, displayLocation, loading, air, airOw } = useWeather();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "#f8fafc" }}>
        <p className="text-slate-400 text-sm">데이터 로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ background: "#f1f5f9", fontFamily: "Inter, sans-serif" }}>
      {/* 헤더 */}
      <div className="px-6 pt-12 pb-4" style={{ background: "#0f172a" }}>
        <p className="text-xs text-slate-400 mb-1">상세 비교</p>
        <h1 className="text-white text-xl font-bold">{displayLocation}</h1>
        <p className="text-slate-400 text-xs mt-1">기상청 · OpenWeather 데이터 비교</p>
      </div>

      <div className="px-4 py-4 pb-32 space-y-3">
        {/* 현재 기온 비교 */}
        {weather && compareWeather ? (
          <>
            <SectionTitle>현재 기온 비교</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <SourceCard
                source="기상청"
                color="#2563eb"
                rows={[
                  { label: "현재 온도", value: `${Math.round(weather.temp)}°` },
                  { label: "체감", value: `${Math.round(weather.feelsLike)}°` },
                  { label: "최고", value: `${Math.round(weather.high)}°` },
                  { label: "최저", value: `${Math.round(weather.low)}°` },
                ]}
              />
              <SourceCard
                source="OpenWeather"
                color="#ea580c"
                rows={[
                  { label: "현재 온도", value: `${Math.round(compareWeather.temp)}°` },
                  { label: "체감", value: `${Math.round(compareWeather.feelsLike)}°` },
                  { label: "최고", value: `${Math.round(compareWeather.high)}°` },
                  { label: "최저", value: `${Math.round(compareWeather.low)}°` },
                ]}
              />
            </div>

            <SectionTitle>대기 환경 비교</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <SourceCard
                source="기상청"
                color="#2563eb"
                rows={[
                  { label: "습도", value: `${weather.humidity}%` },
                  { label: "바람", value: `${Number(weather.wind).toFixed(1)}m/s` },
                  { label: "강수확률", value: `${weather.rainChance}%` },
                  { label: "날씨", value: weather.condition },
                ]}
              />
              <SourceCard
                source="OpenWeather"
                color="#ea580c"
                rows={[
                  { label: "습도", value: `${compareWeather.humidity}%` },
                  { label: "바람", value: `${Number(compareWeather.wind).toFixed(1)}m/s` },
                  { label: "강수확률", value: `${compareWeather.rainChance}%` },
                  { label: "날씨", value: compareWeather.condition },
                ]}
              />
            </div>

            {/* 차이 요약 */}
            <SectionTitle>두 소스의 차이</SectionTitle>
            <div className="rounded-2xl p-4 bg-white space-y-2">
              <DiffRow label="기온 차이" diff={Math.abs(weather.temp - compareWeather.temp).toFixed(1)} unit="°" />
              <DiffRow label="체감온도 차이" diff={Math.abs(weather.feelsLike - compareWeather.feelsLike).toFixed(1)} unit="°" />
              <DiffRow label="습도 차이" diff={Math.abs(weather.humidity - compareWeather.humidity)} unit="%" />
              <DiffRow label="바람 차이" diff={Math.abs(weather.wind - compareWeather.wind).toFixed(1)} unit="m/s" />
            </div>

            {/* 관측 시각 */}
            {(weather.observedAt || compareWeather.observedAt) && (
              <div className="rounded-2xl p-4 bg-white">
                <p className="text-xs font-semibold text-slate-500 mb-2">관측 시각</p>
                {weather.observedAt && (
                  <p className="text-xs text-slate-600">🇰🇷 {weather.observedAt}</p>
                )}
                {compareWeather.observedAt && (
                  <p className="text-xs text-slate-600 mt-1">🌍 {compareWeather.observedAt}</p>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl p-6 bg-white text-center">
            <p className="text-slate-400 text-sm">
              한국 좌표에서만 비교 데이터가 제공됩니다.
            </p>
          </div>
        )}

        {/* 대기질 비교 */}
        {airOw && (
          <>
            <SectionTitle>대기질 비교</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <SourceCard
                source="에어코리아"
                color="#2563eb"
                rows={air ? [
                  { label: "미세먼지", value: `${air.pm10}㎍/㎥`, grade: air.pm10Grade },
                  { label: "초미세먼지", value: `${air.pm25}㎍/㎥`, grade: air.pm25Grade },
                  { label: "측정소", value: air.stationName },
                ] : [
                  { label: "상태", value: "대기 중..." },
                ]}
              />
              <SourceCard
                source="OpenWeather"
                color="#ea580c"
                rows={[
                  { label: "미세먼지", value: `${airOw.pm10}㎍/㎥`, grade: airOw.pm10Grade },
                  { label: "초미세먼지", value: `${airOw.pm25}㎍/㎥`, grade: airOw.pm25Grade },
                  { label: "NO₂", value: `${airOw.no2}㎍/㎥` },
                ]}
              />
            </div>
            {air && (
              <div className="rounded-2xl p-4 bg-white space-y-2">
                <p className="text-xs font-semibold text-slate-500 mb-2">미세먼지 차이</p>
                <DiffRow label="PM10 차이" diff={Math.abs(air.pm10 - airOw.pm10)} unit="㎍/㎥" />
                <DiffRow label="PM2.5 차이" diff={Math.abs(air.pm25 - airOw.pm25)} unit="㎍/㎥" />
              </div>
            )}
          </>
        )}

        {/* 추가 데이터는 계속 추가될 예정 */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(148,163,184,0.15)", border: "1px dashed #cbd5e1" }}>
          <p className="text-xs text-slate-400 text-center">추가 상세 데이터는 계속 업데이트됩니다</p>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <p className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1 pt-2">{children}</p>;
}

function SourceCard({ source, color, rows }) {
  return (
    <div className="rounded-2xl p-4 bg-white">
      <div className="flex items-center gap-1.5 mb-3">
        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        <p className="text-xs font-bold" style={{ color }}>{source}</p>
      </div>
      <div className="space-y-2">
        {rows.map(({ label, value, grade }) => {
          const g = grade ? gradeInfo(grade) : null;
          return (
            <div key={label} className="flex justify-between items-center">
              <span className="text-xs text-slate-400">{label}</span>
              <div className="flex items-center gap-1.5">
                {g && <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: g.color, fontSize: 10 }}>{g.label}</span>}
                <span className="text-sm font-semibold text-slate-800">{value}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DiffRow({ label, diff, unit }) {
  const val = Number(diff);
  const color = val === 0 ? "#16a34a" : val < 2 ? "#d97706" : "#dc2626";
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-bold" style={{ color }}>
        {val === 0 ? "일치" : `${diff}${unit}`}
      </span>
    </div>
  );
}
