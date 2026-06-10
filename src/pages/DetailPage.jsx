import React from "react";
import { useWeather } from "../context/WeatherContext";
import { gradeInfo } from "../utils/weather";
import AirDot from "../components/AirDot";

export default function DetailPage() {
  const { weather, compareWeather, meteoWeather, theme, displayLocation, loading, air, airOw, airMeteo } = useWeather();

  if (loading) {
    return (
      <div className={`flex-1 bg-gradient-to-b ${theme.bg} flex items-center justify-center`}>
        <p className="text-sm" style={{ color: theme.sub }}>데이터 로딩 중...</p>
      </div>
    );
  }

  return (
    <div className={`flex-1 bg-gradient-to-b ${theme.bg} flex flex-col`} style={{ fontFamily: "Inter, sans-serif" }}>
      {/* 헤더 */}
      <div className="px-6 pt-10 pb-4">
        <p className="text-xs mb-1" style={{ color: theme.sub }}>상세 비교</p>
        <h1 className="text-xl font-bold" style={{ color: theme.text }}>{displayLocation}</h1>
        <p className="text-xs mt-1" style={{ color: theme.sub }}>기상청 · OpenWeather · Open-Meteo 비교</p>
      </div>

      <div className="px-4 py-2 pb-32 space-y-3">
        {/* 소스 비교 */}
        {weather && compareWeather ? (
          <>
            <SectionTitle theme={theme}>현재 기온 비교</SectionTitle>
            <ScrollCompare
              theme={theme}
              sources={[
                { name: "기상청",       color: "#2563eb", rows: [
                  { label: "현재 온도", value: `${Number(weather.temp).toFixed(1)}°` },
                  { label: "체감",      value: `${Number(weather.feelsLike).toFixed(1)}°` },
                  { label: "최고",      value: `${Number(weather.high).toFixed(1)}°` },
                  { label: "최저",      value: `${Number(weather.low).toFixed(1)}°` },
                ]},
                { name: "OpenWeather", color: "#ea580c", rows: [
                  { label: "현재 온도", value: `${Number(compareWeather.temp).toFixed(1)}°` },
                  { label: "체감",      value: `${Number(compareWeather.feelsLike).toFixed(1)}°` },
                  { label: "최고",      value: `${Number(compareWeather.high).toFixed(1)}°` },
                  { label: "최저",      value: `${Number(compareWeather.low).toFixed(1)}°` },
                ]},
                ...(meteoWeather ? [{ name: "Open-Meteo", color: "#059669", rows: [
                  { label: "현재 온도", value: `${Number(meteoWeather.temp).toFixed(1)}°` },
                  { label: "체감",      value: `${Number(meteoWeather.feelsLike).toFixed(1)}°` },
                  { label: "최고",      value: `${Number(meteoWeather.high).toFixed(1)}°` },
                  { label: "최저",      value: `${Number(meteoWeather.low).toFixed(1)}°` },
                ]}] : []),
              ]}
            />

            <SectionTitle theme={theme}>대기 환경 비교</SectionTitle>
            <ScrollCompare
              theme={theme}
              sources={[
                { name: "기상청",       color: "#2563eb", rows: [
                  { label: "날씨",      value: weather.condition },
                  { label: "습도",      value: `${weather.humidity}%` },
                  { label: "바람",      value: `${Number(weather.wind).toFixed(1)}m/s` },
                  { label: "강수확률",  value: `${weather.rainChance}%` },
                ]},
                { name: "OpenWeather", color: "#ea580c", rows: [
                  { label: "날씨",      value: compareWeather.condition },
                  { label: "습도",      value: `${compareWeather.humidity}%` },
                  { label: "바람",      value: `${Number(compareWeather.wind).toFixed(1)}m/s` },
                  { label: "강수확률",  value: `${compareWeather.rainChance}%` },
                ]},
                ...(meteoWeather ? [{ name: "Open-Meteo", color: "#059669", rows: [
                  { label: "날씨",      value: meteoWeather.condition },
                  { label: "습도",      value: `${meteoWeather.humidity}%` },
                  { label: "바람",      value: `${Number(meteoWeather.wind).toFixed(1)}m/s` },
                  { label: "강수확률",  value: `${meteoWeather.rainChance}%` },
                ]}] : []),
              ]}
            />

            {/* 기상청 기준 차이 */}
            <SectionTitle theme={theme}>기상청 기준 차이</SectionTitle>
            <div className="rounded-2xl p-4 space-y-2" style={{ background: theme.card }}>
              <p className="text-[10px] mb-2" style={{ color: theme.sub, opacity: 0.8 }}>기상청 실측값과의 차이</p>
              {[
                { label: "기온 (OW)",        diff: Math.abs(weather.temp - compareWeather.temp).toFixed(1), unit: "°" },
                { label: "기온 (Meteo)",      diff: meteoWeather ? Math.abs(weather.temp - meteoWeather.temp).toFixed(1) : null, unit: "°" },
                { label: "습도 (OW)",         diff: Math.abs(weather.humidity - compareWeather.humidity), unit: "%" },
                { label: "습도 (Meteo)",      diff: meteoWeather ? Math.abs(weather.humidity - meteoWeather.humidity) : null, unit: "%" },
              ].filter(r => r.diff !== null).map(r => (
                <DiffRow key={r.label} theme={theme} label={r.label} diff={r.diff} unit={r.unit} />
              ))}
            </div>

            {/* 관측 시각 */}
            <div className="rounded-2xl p-4" style={{ background: theme.card }}>
              <p className="text-xs font-semibold mb-2" style={{ color: theme.sub }}>관측 시각</p>
              {weather.observedAt && <p className="text-xs" style={{ color: theme.text }}>🇰🇷 {weather.observedAt}</p>}
              {compareWeather.observedAt && <p className="text-xs mt-1" style={{ color: theme.text }}>🌍 {compareWeather.observedAt}</p>}
              {meteoWeather?.observedAt && <p className="text-xs mt-1" style={{ color: theme.text }}>🌿 {meteoWeather.observedAt}</p>}
            </div>
          </>
        ) : (
          <div className="rounded-2xl p-6 text-center" style={{ background: theme.card }}>
            <p className="text-sm" style={{ color: theme.sub }}>
              한국 좌표에서만 비교 데이터가 제공됩니다.
            </p>
          </div>
        )}

        {/* 대기질 비교 */}
        {(airOw || airMeteo) && (
          <>
            <SectionTitle theme={theme}>대기질 비교</SectionTitle>
            <ScrollCompare
              theme={theme}
              sources={[
                { name: "에어코리아", color: "#2563eb", rows: air ? [
                  { label: "미세먼지",   value: `${air.pm10}㎍/㎥`,  grade: air.pm10Grade },
                  { label: "초미세먼지", value: `${air.pm25}㎍/㎥`,  grade: air.pm25Grade },
                  { label: "측정소",    value: air.stationName },
                ] : [{ label: "상태", value: "대기 중..." }]},
                ...(airOw ? [{ name: "OpenWeather", color: "#ea580c", rows: [
                  { label: "미세먼지",   value: `${airOw.pm10}㎍/㎥`,  grade: airOw.pm10Grade },
                  { label: "초미세먼지", value: `${airOw.pm25}㎍/㎥`,  grade: airOw.pm25Grade },
                  { label: "NO₂",       value: `${airOw.no2}㎍/㎥` },
                ]}] : []),
                ...(airMeteo ? [{ name: "Open-Meteo", color: "#059669", rows: [
                  { label: "미세먼지",   value: `${airMeteo.pm10}㎍/㎥`,  grade: airMeteo.pm10Grade },
                  { label: "초미세먼지", value: `${airMeteo.pm25}㎍/㎥`,  grade: airMeteo.pm25Grade },
                ]}] : []),
              ]}
            />
            {air && airOw && (
              <div className="rounded-2xl p-4 space-y-2" style={{ background: theme.card }}>
                <p className="text-xs font-semibold mb-2" style={{ color: theme.sub }}>에어코리아 기준 차이</p>
                <DiffRow theme={theme} label="PM10 (OW)"    diff={Math.abs(air.pm10 - airOw.pm10)}    unit="㎍/㎥" />
                <DiffRow theme={theme} label="PM2.5 (OW)"   diff={Math.abs(air.pm25 - airOw.pm25)}    unit="㎍/㎥" />
                {airMeteo && <DiffRow theme={theme} label="PM10 (Meteo)"  diff={Math.abs(air.pm10 - airMeteo.pm10)}  unit="㎍/㎥" />}
                {airMeteo && <DiffRow theme={theme} label="PM2.5 (Meteo)" diff={Math.abs(air.pm25 - airMeteo.pm25)}  unit="㎍/㎥" />}
              </div>
            )}
          </>
        )}

        {/* 추가 데이터는 계속 추가될 예정 */}
        <div className="rounded-2xl p-4" style={{ background: theme.card, border: `1px dashed ${theme.sub}`, opacity: 0.7 }}>
          <p className="text-xs text-center" style={{ color: theme.sub }}>추가 상세 데이터는 계속 업데이트됩니다</p>
        </div>
      </div>
    </div>
  );
}

function ScrollCompare({ sources, theme }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
      <div className="flex gap-3" style={{ minWidth: sources.length > 2 ? 340 : "auto" }}>
        {sources.map(({ name, color, rows }) => (
          <div key={name} className="rounded-2xl p-4 flex-1 min-w-[100px]" style={{ background: theme.card }}>
            <div className="flex items-center gap-1.5 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <p className="text-xs font-bold" style={{ color }}>{name}</p>
            </div>
            <div className="space-y-2">
              {rows.map(({ label, value, grade }) => {
                const g = grade ? gradeInfo(grade) : null;
                return (
                  <div key={label} className="flex justify-between items-center gap-2">
                    <span className="text-xs whitespace-nowrap" style={{ color: theme.sub }}>{label}</span>
                    <div className="flex items-center gap-1">
                      {g && <span className="text-xs font-bold" style={{ color: g.dotColor }}>{g.label}</span>}
                      <span className="text-sm font-semibold" style={{ color: theme.text }}>{value}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ children, theme }) {
  return <p className="text-xs font-bold uppercase tracking-widest px-1 pt-2" style={{ color: theme.sub }}>{children}</p>;
}

function DiffRow({ label, diff, unit, theme }) {
  const val = Number(diff);
  const color = val === 0 ? "#16a34a" : val < 2 ? "#d97706" : "#dc2626";
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs" style={{ color: theme.sub }}>{label}</span>
      <span className="text-sm font-bold" style={{ color }}>
        {val === 0 ? "일치" : `${diff}${unit}`}
      </span>
    </div>
  );
}
