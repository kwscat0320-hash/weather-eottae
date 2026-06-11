import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWeather } from "../context/WeatherContext";
import { gradeInfo } from "../utils/weather";
import AirCompareCard from "../components/AirCompareCard";
import { TemperatureBarChart, WeatherRadarChart, ChartLegend } from "../components/WeatherCharts";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { PullIndicator, RefreshToast } from "../components/PullToRefreshUI";

export default function DetailPage({ scrollRef }) {
  const { weather, compareWeather, meteoWeather, wapiWeather, theme, displayLocation, loading, air, airOw, airMeteo, airWapi, requestCurrentLocation } = useWeather();

  const handleForceRefresh = () => requestCurrentLocation(true);
  const { pullDist, PULL_THRESHOLD, showToast } = usePullToRefresh(scrollRef, handleForceRefresh, loading);

  if (loading) {
    return (
      <div className={`flex-1 bg-gradient-to-b ${theme.bg} flex items-center justify-center`}>
        <p className="text-sm" style={{ color: theme.sub }}>데이터 로딩 중...</p>
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
        <p className="text-xs mb-1" style={{ color: theme.sub }}>상세 비교</p>
        <h1 className="text-xl font-bold" style={{ color: theme.text }}>{displayLocation}</h1>
        <p className="text-xs mt-1" style={{ color: theme.sub }}>기상청 · OpenWeather · Open-Meteo 비교</p>
      </div>

      <div className="px-4 py-2 pb-32 space-y-3">
        {weather && compareWeather ? (
          <>
            {/* 날씨 상태 */}
            <SectionTitle theme={theme}>날씨 상태</SectionTitle>
            <div className="rounded-3xl p-4" style={{ background: theme.card }}>
              {(() => {
                const src = [
                  { name: "기상청",     color: "#2563eb", cond: weather.condition },
                  { name: "오픈웨더",         color: "#ea580c", cond: compareWeather.condition },
                  ...(meteoWeather ? [{ name: "오픈메테오", color: "#059669", cond: meteoWeather.condition }] : []),
                  ...(wapiWeather  ? [{ name: "웨더API", color: "#7c3aed", cond: wapiWeather.condition }] : []),
                ];
                return (
                  <div className="flex gap-2 flex-wrap">
                    {src.map(s => (
                      <div key={s.name} className="flex flex-col items-center gap-1.5 flex-1">
                        <span className="text-[10px] font-semibold" style={{ color: s.color }}>{s.name}</span>
                        <span className="text-sm font-bold px-3 py-1.5 rounded-2xl w-full text-center"
                          style={{ background: `${s.color}18`, color: s.color }}>
                          {s.cond || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* 온도 비교 — 세로 막대 */}
            <SectionTitle theme={theme}>온도 비교</SectionTitle>
            <div className="rounded-3xl px-4 pt-4 pb-2" style={{ background: theme.card }}>
              <ChartLegend
                sources={[
                  { name: "기상청", color: "#2563eb" },
                  { name: "오픈웨더",     color: "#ea580c" },
                  ...(meteoWeather ? [{ name: "오픈메테오", color: "#059669" }] : []),
                  ...(wapiWeather  ? [{ name: "웨더API", color: "#7c3aed" }] : []),
                ]}
                theme={theme}
              />
              <TemperatureBarChart
                weather={weather}
                compareWeather={compareWeather}
                meteoWeather={meteoWeather}
                wapiWeather={wapiWeather}
                theme={theme}
              />
            </div>

            {/* 대기환경 비교 — 레이더 차트 */}
            <SectionTitle theme={theme}>대기환경 비교</SectionTitle>
            <div className="rounded-3xl px-4 pt-4 pb-2" style={{ background: theme.card }}>
              <ChartLegend
                sources={[
                  { name: "기상청", color: "#2563eb" },
                  { name: "오픈웨더",     color: "#ea580c" },
                  ...(meteoWeather ? [{ name: "오픈메테오", color: "#059669" }] : []),
                  ...(wapiWeather  ? [{ name: "웨더API", color: "#7c3aed" }] : []),
                ]}
                theme={theme}
              />
              <WeatherRadarChart
                weather={weather}
                compareWeather={compareWeather}
                meteoWeather={meteoWeather}
                wapiWeather={wapiWeather}
                theme={theme}
              />
            </div>

            {/* 관측 시각 */}
            <div className="rounded-2xl p-4" style={{ background: theme.card }}>
              <p className="text-xs font-semibold mb-2" style={{ color: theme.sub }}>관측 시각</p>
              {weather.observedAt        && <p className="text-xs" style={{ color: theme.text }}>🇰🇷 {weather.observedAt}</p>}
              {compareWeather.observedAt && <p className="text-xs mt-1" style={{ color: theme.text }}>🌍 {compareWeather.observedAt}</p>}
              {meteoWeather?.observedAt  && <p className="text-xs mt-1" style={{ color: theme.text }}>🌿 {meteoWeather.observedAt}</p>}
            </div>
          </>
        ) : (
          <div className="rounded-2xl p-6 text-center" style={{ background: theme.card }}>
            <p className="text-sm" style={{ color: theme.sub }}>한국 좌표에서만 비교 데이터가 제공됩니다.</p>
          </div>
        )}

        {/* 대기질 비교 — 도넛 차트 */}
        {(air || airOw || airMeteo || airWapi) && (
          <>
            <SectionTitle theme={theme}>대기질 비교</SectionTitle>
            <AirCompareCard air={air} airOw={airOw} airMeteo={airMeteo} airWapi={airWapi} theme={theme} />
          </>
        )}
      </div>
      </div>{/* 스크롤 레이어 끝 */}
    </div>
  );
}

// SwipeCompareCard — 더 이상 사용하지 않음 (하위 호환용으로만 남김)
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
    { name: "오픈웨더",         color: "#ea580c", w: compareWeather },
    ...(meteoWeather ? [{ name: "오픈메테오", color: "#059669", w: meteoWeather }] : []),
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
