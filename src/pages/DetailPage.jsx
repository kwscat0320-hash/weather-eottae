import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWeather } from "../context/WeatherContext";
import { gradeInfo } from "../utils/weather";
import AirDot from "../components/AirDot";
import AirCompareCard from "../components/AirCompareCard";

export default function DetailPage({ scrollRef }) {
  const { weather, compareWeather, meteoWeather, theme, displayLocation, loading, air, airOw, airMeteo } = useWeather();

  if (loading) {
    return (
      <div className={`flex-1 bg-gradient-to-b ${theme.bg} flex items-center justify-center`}>
        <p className="text-sm" style={{ color: theme.sub }}>데이터 로딩 중...</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className={`flex-1 bg-gradient-to-b ${theme.bg} flex flex-col overflow-y-auto`}
      style={{ fontFamily: "Inter, sans-serif", scrollbarWidth: "none" }}>
      {/* 헤더 */}
      <div className="px-6 pt-10 pb-4">
        <p className="text-xs mb-1" style={{ color: theme.sub }}>상세 비교</p>
        <h1 className="text-xl font-bold" style={{ color: theme.text }}>{displayLocation}</h1>
        <p className="text-xs mt-1" style={{ color: theme.sub }}>기상청 · OpenWeather · Open-Meteo 비교</p>
      </div>

      <div className="px-4 py-2 pb-32 space-y-3">
        {weather && compareWeather ? (
          <>
            {/* 날씨 소스 비교 — 바 차트 */}
            <SectionTitle theme={theme}>날씨 소스 비교</SectionTitle>
            <WeatherSourcesChart
              weather={weather}
              compareWeather={compareWeather}
              meteoWeather={meteoWeather}
              theme={theme}
            />

            {/* 현재 기온 비교 */}
            <SectionTitle theme={theme}>현재 기온 비교</SectionTitle>
            <SwipeCompareCard
              theme={theme}
              sources={[
                { name: "기상청", color: "#2563eb", rows: [
                  { label: "현재 온도", value: `${Number(weather.temp).toFixed(1)}°` },
                  { label: "체감",      value: `${Number(weather.feelsLike).toFixed(1)}°` },
                  { label: "최고",      value: `${Number(weather.high).toFixed(1)}°` },
                  { label: "최저",      value: `${Number(weather.low).toFixed(1)}°` },
                ]},
                { name: "OW", color: "#ea580c", rows: [
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

            {/* 대기 환경 비교 */}
            <SectionTitle theme={theme}>대기 환경 비교</SectionTitle>
            <SwipeCompareCard
              theme={theme}
              sources={[
                { name: "기상청", color: "#2563eb", rows: [
                  { label: "날씨",     value: weather.condition },
                  { label: "습도",     value: `${weather.humidity}%` },
                  { label: "바람",     value: `${Number(weather.wind).toFixed(1)}m/s` },
                  { label: "강수확률", value: `${weather.rainChance}%` },
                ]},
                { name: "OW", color: "#ea580c", rows: [
                  { label: "날씨",     value: compareWeather.condition },
                  { label: "습도",     value: `${compareWeather.humidity}%` },
                  { label: "바람",     value: `${Number(compareWeather.wind).toFixed(1)}m/s` },
                  { label: "강수확률", value: `${compareWeather.rainChance}%` },
                ]},
                ...(meteoWeather ? [{ name: "Open-Meteo", color: "#059669", rows: [
                  { label: "날씨",     value: meteoWeather.condition },
                  { label: "습도",     value: `${meteoWeather.humidity}%` },
                  { label: "바람",     value: `${Number(meteoWeather.wind).toFixed(1)}m/s` },
                  { label: "강수확률", value: `${meteoWeather.rainChance}%` },
                ]}] : []),
              ]}
            />

            {/* 기상청 기준 차이 */}
            <SectionTitle theme={theme}>기상청 기준 차이</SectionTitle>
            <div className="rounded-2xl p-4 space-y-2" style={{ background: theme.card }}>
              <p className="text-[10px] mb-2" style={{ color: theme.sub, opacity: 0.8 }}>기상청 실측값과의 차이</p>
              {[
                { label: "기온 (OW)",     diff: Math.abs(weather.temp - compareWeather.temp).toFixed(1),                                  unit: "°" },
                { label: "기온 (Meteo)",  diff: meteoWeather ? Math.abs(weather.temp - meteoWeather.temp).toFixed(1) : null,               unit: "°" },
                { label: "습도 (OW)",     diff: Math.abs(weather.humidity - compareWeather.humidity),                                      unit: "%" },
                { label: "습도 (Meteo)",  diff: meteoWeather ? Math.abs(weather.humidity - meteoWeather.humidity) : null,                  unit: "%" },
              ].filter(r => r.diff !== null).map(r => (
                <DiffRow key={r.label} theme={theme} label={r.label} diff={r.diff} unit={r.unit} />
              ))}
            </div>

            {/* 관측 시각 */}
            <div className="rounded-2xl p-4" style={{ background: theme.card }}>
              <p className="text-xs font-semibold mb-2" style={{ color: theme.sub }}>관측 시각</p>
              {weather.observedAt      && <p className="text-xs" style={{ color: theme.text }}>🇰🇷 {weather.observedAt}</p>}
              {compareWeather.observedAt && <p className="text-xs mt-1" style={{ color: theme.text }}>🌍 {compareWeather.observedAt}</p>}
              {meteoWeather?.observedAt  && <p className="text-xs mt-1" style={{ color: theme.text }}>🌿 {meteoWeather.observedAt}</p>}
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
        {(air || airOw || airMeteo) && (
          <>
            <SectionTitle theme={theme}>대기질 비교</SectionTitle>
            <AirCompareCard air={air} airOw={airOw} airMeteo={airMeteo} theme={theme} />
          </>
        )}

        {/* 추가 데이터 예고 */}
        <div className="rounded-2xl p-4" style={{ background: theme.card, border: `1px dashed ${theme.sub}`, opacity: 0.7 }}>
          <p className="text-xs text-center" style={{ color: theme.sub }}>추가 상세 데이터는 계속 업데이트됩니다</p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SwipeCompareCard — 탭 버튼 + 좌우 스와이프로 소스 전환
// ══════════════════════════════════════════════════════════════════════════
function SwipeCompareCard({ sources, theme }) {
  const [active, setActive] = useState(0);
  const [dir, setDir]       = useState(1);

  const goTo = (i) => {
    if (i === active) return;
    setDir(i > active ? 1 : -1);
    setActive(i);
  };

  const handleDragEnd = (_, info) => {
    if (info.offset.x < -50 && active < sources.length - 1) goTo(active + 1);
    else if (info.offset.x > 50 && active > 0) goTo(active - 1);
  };

  const src = sources[active];
  if (!src) return null;

  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: theme.card }}>

      {/* 소스 탭 */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex gap-1.5">
          {sources.map((s, i) => (
            <button
              key={s.name}
              onClick={() => goTo(i)}
              className="flex-1 py-1.5 rounded-2xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1"
              style={{
                background: i === active ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.07)",
                color: i === active ? (s.color ?? theme.text) : theme.sub,
                boxShadow: i === active ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
              }}
            >
              {i === active && (
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: s.color ?? theme.text }} />
              )}
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* 슬라이드 가능한 컨텐츠 */}
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={active}
          custom={dir}
          variants={{
            enter:  (d) => ({ x: d * 48, opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit:   (d) => ({ x: d * -48, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2, ease: "easeOut" }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          onDragEnd={handleDragEnd}
          className="px-4 pb-5 cursor-grab active:cursor-grabbing select-none"
        >
          <div>
            {src.rows.map(({ label, value, grade }, idx) => {
              const g = grade ? gradeInfo(grade) : null;
              return (
                <div
                  key={label}
                  className="flex justify-between items-center py-2"
                  style={{
                    borderBottom: idx < src.rows.length - 1
                      ? "1px solid rgba(0,0,0,0.06)"
                      : "none",
                  }}
                >
                  <span className="text-sm" style={{ color: theme.sub }}>{label}</span>
                  <div className="flex items-center gap-1.5">
                    {g && <AirDot color={g.dotColor} size={14} />}
                    {g && (
                      <span className="text-xs font-bold" style={{ color: "#000000" }}>
                        {g.label}
                      </span>
                    )}
                    <span className="text-sm font-bold" style={{ color: theme.text }}>{value}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 페이지 인디케이터 */}
          {sources.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-4">
              {sources.map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ width: i === active ? 20 : 6 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-full"
                  style={{
                    height: 6,
                    background: i === active ? theme.sub : `${theme.sub}55`,
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// WeatherSourcesChart — 세 예보 모델 동시 바 차트 비교
// ══════════════════════════════════════════════════════════════════════════
const METRICS = [
  { key: "temp",       label: "기온",    unit: "°",    fmt: v => Number(v).toFixed(1) },
  { key: "feelsLike",  label: "체감",    unit: "°",    fmt: v => Number(v).toFixed(1) },
  { key: "high",       label: "최고",    unit: "°",    fmt: v => Number(v).toFixed(1) },
  { key: "low",        label: "최저",    unit: "°",    fmt: v => Number(v).toFixed(1) },
  { key: "humidity",   label: "습도",    unit: "%",    fmt: v => Math.round(v), fixedMax: 100 },
  { key: "wind",       label: "바람",    unit: "m/s",  fmt: v => Number(v).toFixed(1) },
  { key: "rainChance", label: "강수확률", unit: "%",   fmt: v => Math.round(v), fixedMax: 100 },
];

function WeatherSourcesChart({ weather, compareWeather, meteoWeather, theme }) {
  const sources = [
    { name: "기상청",     color: "#2563eb", w: weather },
    { name: "OW",         color: "#ea580c", w: compareWeather },
    ...(meteoWeather ? [{ name: "Open-Meteo", color: "#059669", w: meteoWeather }] : []),
  ].filter(s => s.w);

  return (
    <div className="rounded-3xl p-5" style={{ background: theme.card }}>

      {/* 범례 */}
      <div className="flex gap-4 mb-5 flex-wrap">
        {sources.map(s => (
          <div key={s.name} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-xs font-semibold" style={{ color: theme.sub }}>{s.name}</span>
          </div>
        ))}
      </div>

      {/* 날씨(텍스트) */}
      <div className="mb-5">
        <p className="text-[10px] font-semibold mb-2 uppercase tracking-wide" style={{ color: theme.sub, opacity: 0.55 }}>날씨</p>
        <div className="flex gap-2 flex-wrap">
          {sources.map(s => (
            <span key={s.name} className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: `${s.color}22`, color: s.color }}>
              {s.w.condition || "—"}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-5" style={{ height: 1, background: "rgba(0,0,0,0.07)" }} />

      {/* 수치 메트릭 바 차트 */}
      <div className="space-y-5">
        {METRICS.map(metric => {
          const vals = sources.map(s => ({ ...s, num: Number(s.w[metric.key]) || 0 }));
          const allNums = vals.map(v => v.num);
          const rawMax  = Math.max(...allNums);
          const rawMin  = Math.min(...allNums);
          // 온도: 값 범위를 넓혀 상대적 차이 부각, 퍼센트/기타: 0 기저
          const baseMin = metric.unit === "°"
            ? Math.max(0, rawMin - (rawMax - rawMin + 2) * 0.8)
            : 0;
          const scaleMax = metric.fixedMax ?? Math.max(rawMax * 1.15, baseMin + 1);

          return (
            <div key={metric.key}>
              <p className="text-[10px] font-semibold mb-2 uppercase tracking-wide"
                style={{ color: theme.sub, opacity: 0.55 }}>
                {metric.label}
              </p>
              <div className="space-y-2">
                {vals.map(v => {
                  const pct = Math.min(
                    Math.max(((v.num - baseMin) / (scaleMax - baseMin)) * 100, 5),
                    100
                  );
                  const label = `${metric.fmt(v.num)}${metric.unit}`;
                  return (
                    <div key={v.name} className="flex items-center gap-2">
                      <div className="flex-1 rounded-full overflow-hidden"
                        style={{ height: 24, background: "rgba(0,0,0,0.07)" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.55, ease: "easeOut" }}
                          className="h-full rounded-full flex items-center justify-end pr-2.5"
                          style={{ background: v.color, minWidth: 48 }}
                        >
                          <span className="text-xs font-bold leading-none"
                            style={{ color: "rgba(255,255,255,0.95)" }}>
                            {label}
                          </span>
                        </motion.div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionTitle({ children, theme }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest px-1 pt-2" style={{ color: theme.sub }}>
      {children}
    </p>
  );
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
