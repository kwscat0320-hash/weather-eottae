import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, RefreshCw, Droplets, Wind, Umbrella } from "lucide-react";
import { useWeather } from "../context/WeatherContext";
import { gradeInfo } from "../utils/weather";
import AirDot from "../components/AirDot";

export default function HomePage({ scrollRef }) {
  const {
    weather, theme, speech, todayForecasts, dailyForecasts,
    compareWeather, meteoWeather, owForecast, meteoForecast,
    hourSlots, alignedHourly,
    displayLocation, loading, error,
    coords, requestCurrentLocation, air, airOw, airMeteo,
    weatherHistory, forecastHistory,
  } = useWeather();

  const dateStr = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });

  // 날씨 섹션 높이 측정 → 카드 스페이서에 사용
  const weatherRef = useRef(null);
  const [weatherHeight, setWeatherHeight] = useState(340);
  useEffect(() => {
    if (!weatherRef.current) return;
    const obs = new ResizeObserver(entries => {
      setWeatherHeight(entries[0].contentRect.height);
    });
    obs.observe(weatherRef.current);
    return () => obs.disconnect();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "#FFDF20" }}>
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4" />
          <p className="font-medium" style={{ color: "#BA4C00" }}>날씨 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6" style={{ background: "#fee2e2" }}>
        <div className="text-center">
          <p className="text-4xl mb-4">😿</p>
          <p className="text-slate-700 font-medium mb-4">{error}</p>
          <button onClick={requestCurrentLocation}
            className="px-5 py-2 bg-slate-800 text-white rounded-2xl text-sm font-semibold">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // ── 날씨 소스 비교 데이터 ──────────────────────────────────────────────
  const weatherSources = [
    ...(weather ? [{
      name: "기상청",
      obs: weather.observedAt,
      rows: [
        { label: "날씨",     value: weather.condition },
        { label: "기온",     value: `${Number(weather.temp).toFixed(1)}°` },
        { label: "체감",     value: `${Number(weather.feelsLike).toFixed(1)}°` },
        { label: "최고",     value: `${Number(weather.high).toFixed(1)}°` },
        { label: "최저",     value: `${Number(weather.low).toFixed(1)}°` },
        { label: "습도",     value: `${weather.humidity}%` },
        { label: "바람",     value: `${Number(weather.wind).toFixed(1)}m/s` },
        { label: "강수확률", value: `${weather.rainChance}%` },
      ],
    }] : []),
    ...(compareWeather ? [{
      name: "OW",
      obs: compareWeather.observedAt,
      rows: [
        { label: "날씨",     value: compareWeather.condition },
        { label: "기온",     value: `${Number(compareWeather.temp).toFixed(1)}°` },
        { label: "체감",     value: `${Number(compareWeather.feelsLike).toFixed(1)}°` },
        { label: "최고",     value: `${Number(compareWeather.high).toFixed(1)}°` },
        { label: "최저",     value: `${Number(compareWeather.low).toFixed(1)}°` },
        { label: "습도",     value: `${compareWeather.humidity}%` },
        { label: "바람",     value: `${Number(compareWeather.wind).toFixed(1)}m/s` },
        { label: "강수확률", value: `${compareWeather.rainChance}%` },
      ],
    }] : []),
    ...(meteoWeather ? [{
      name: "Open-Meteo",
      obs: meteoWeather.observedAt,
      rows: [
        { label: "날씨",     value: meteoWeather.condition },
        { label: "기온",     value: `${Number(meteoWeather.temp).toFixed(1)}°` },
        { label: "체감",     value: `${Number(meteoWeather.feelsLike).toFixed(1)}°` },
        { label: "최고",     value: `${Number(meteoWeather.high).toFixed(1)}°` },
        { label: "최저",     value: `${Number(meteoWeather.low).toFixed(1)}°` },
        { label: "습도",     value: `${meteoWeather.humidity}%` },
        { label: "바람",     value: `${Number(meteoWeather.wind).toFixed(1)}m/s` },
        { label: "강수확률", value: `${meteoWeather.rainChance}%` },
      ],
    }] : []),
  ];

  // ── 공기질 소스 비교 데이터 ────────────────────────────────────────────
  const airSources = [
    ...(air ? [{
      name: "에어코리아",
      obs: air.stationName ? `측정소: ${air.stationName}` : null,
      rows: [
        { label: "미세먼지",   value: air.pm10 !== "-" ? `${air.pm10}㎍/㎥` : "-", grade: air.pm10Grade },
        { label: "초미세먼지", value: air.pm25 !== "-" ? `${air.pm25}㎍/㎥` : "-", grade: air.pm25Grade },
      ],
    }] : []),
    ...(airOw ? [{
      name: "OpenWeather",
      obs: null,
      rows: [
        { label: "미세먼지",   value: `${airOw.pm10}㎍/㎥`, grade: airOw.pm10Grade },
        { label: "초미세먼지", value: `${airOw.pm25}㎍/㎥`, grade: airOw.pm25Grade },
      ],
    }] : []),
    ...(airMeteo ? [{
      name: "Open-Meteo",
      obs: null,
      rows: [
        { label: "미세먼지",   value: `${airMeteo.pm10}㎍/㎥`, grade: airMeteo.pm10Grade },
        { label: "초미세먼지", value: `${airMeteo.pm25}㎍/㎥`, grade: airMeteo.pm25Grade },
      ],
    }] : []),
  ];

  return (
    <div className={`flex-1 bg-gradient-to-b ${theme.bg} relative overflow-hidden`}>

      {/* ══════════════════════════════════════════════════════════════════
          고정 배경 영역 — 절대 위치, 스크롤에 영향받지 않음
      ══════════════════════════════════════════════════════════════════ */}
      <div ref={weatherRef} className="absolute top-0 left-0 right-0 z-10 pointer-events-auto">

        {/* 상단 바 */}
        <div className="flex items-start justify-between px-6 pt-10 pb-0">
          <div>
            <p className="text-xs font-medium" style={{ color: theme.sub }}>{dateStr}</p>
            <div className="flex items-center gap-1 mt-0.5" style={{ color: theme.sub }}>
              <MapPin size={12} />
              <span className="text-xs">{displayLocation}</span>
            </div>
          </div>
          <button onClick={() => requestCurrentLocation(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center mt-1"
            style={{ background: "rgba(255,254,254,0.3)" }}>
            <RefreshCw size={16} style={{ color: theme.text }} />
          </button>
        </div>

        {/* 날씨 정보 + 캐릭터 */}
        <div className="flex items-end px-6 pt-4 pb-4">
          <div className="flex-1">
            <p className="text-xl font-semibold" style={{ color: theme.text }}>{weather?.condition}</p>
            <p className="text-xs font-semibold mt-1" style={{ color: theme.sub }}>현재온도</p>
            <div className="font-bold leading-none mt-0.5" style={{ fontSize: 72, color: theme.text }}>
              {weather?.temp.toFixed(1)}°
            </div>
            <p className="text-sm mt-2" style={{ color: theme.sub }}>
              최고 {weather?.high.toFixed(1)}° / 최저 {weather?.low.toFixed(1)}° · 체감 {weather?.feelsLike.toFixed(1)}°
            </p>
          </div>
          <div className="relative flex flex-col items-end">
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl px-3 py-2 shadow-md mb-2 max-w-[140px]"
              style={{ borderBottomRightRadius: 4 }}>
              <p className="text-xs font-semibold leading-relaxed" style={{ color: "#1C283C" }}>{speech}</p>
            </motion.div>
            <motion.img key={theme.img} src={theme.img} alt="날씨 캐릭터"
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{ width: 160, height: 160, objectFit: "contain" }}
              className="drop-shadow-xl" />
          </div>
        </div>

      </div>
      {/* ═══════════════════════════════ 고정 배경 끝 ════════════════════ */}

      {/* ══════════════════════════════════════════════════════════════════
          스크롤 레이어 — 카드들만 위로 올라가며 배경을 덮음
      ══════════════════════════════════════════════════════════════════ */}
      <div
        ref={scrollRef}
        className="absolute inset-0 z-20 overflow-y-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {/* 투명 스페이서 — 날씨 섹션 높이만큼 띄워서 카드가 아래에서 시작 */}
        <div style={{ height: weatherHeight, flexShrink: 0 }} />

        {/* 카드 래퍼 — 여기서부터 올라오며 배경을 덮음 */}
        <div className="px-4 pb-32 space-y-3">

        {/* 요약 카드 */}
        <div className="rounded-3xl p-4" style={{ background: theme.card }}>
          <div className="grid grid-cols-3 gap-3">
            <Metric icon={<Droplets size={18} />} label="습도" value={`${weather?.humidity}%`} sub={theme.sub} text={theme.text} />
            <Metric icon={<Wind size={18} />} label="풍속" value={`${Number(weather?.wind).toFixed(1)}m/s`} sub={theme.sub} text={theme.text} />
            <Metric icon={<Umbrella size={18} />} label="강수" value={`${weather?.rainChance}%`} sub={theme.sub} text={theme.text} />
          </div>
          {air && (
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3" style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
              <AirCard label="미세먼지"   value={air.pm10}  grade={air.pm10Grade}  sub={theme.sub} />
              <AirCard label="초미세먼지" value={air.pm25}  grade={air.pm25Grade}  sub={theme.sub} />
            </div>
          )}
        </div>

        {/* 시간대별 예보 — 소스 탭 + 스와이프 */}
        <HourlyForecastCard
          hourSlots={hourSlots}
          alignedHourly={alignedHourly}
          theme={theme}
        />

        {/* 날씨 소스 비교 — 스와이프 카드 */}
        {weatherSources.length >= 1 && (
          <SwipeCompareCard title="날씨 소스 비교" sources={weatherSources} theme={theme} />
        )}

        {/* 공기질 비교 — 스와이프 카드 */}
        {airSources.length >= 1 && (
          <SwipeCompareCard title="공기질 비교" sources={airSources} theme={theme} />
        )}

        {/* 기상청 5일 예보 */}
        <div className="rounded-3xl p-4" style={{ background: theme.card }}>
          <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>기상청 5일 예보</p>
          <div className="space-y-3">
            {dailyForecasts.map((day) => (
              <div key={day.date} className="flex items-center justify-between"
                style={{ opacity: day._fromHistory ? 0.65 : 1 }}>
                <p className="text-sm font-medium w-28" style={{ color: theme.text }}>
                  {day.date}
                  {day._fromHistory && (
                    <span className="text-[9px] ml-1" style={{ color: theme.sub, opacity: 0.7 }}>이력</span>
                  )}
                </p>
                <p className="text-xs" style={{ color: theme.sub }}>비 {day.rainChance}%</p>
                <p className="text-sm font-semibold" style={{ color: theme.text }}>
                  {Number(day.min).toFixed(1)}° / {Number(day.max).toFixed(1)}°
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Open-Meteo 추가 정보 카드 */}
        {meteoWeather && (
          <MeteoExtraCard meteo={meteoWeather} theme={theme} />
        )}

        {/* 최근 기상 기록 */}
        {weatherHistory && weatherHistory.length > 0 && (
          <WeatherHistoryCard history={weatherHistory} theme={theme} />
        )}

        {/* 예보 이력 — 그제/어제/오늘 저장된 3일치 예보 비교 */}
        {forecastHistory && forecastHistory.length > 0 && (
          <ForecastHistoryCard history={forecastHistory} theme={theme} />
        )}

        </div>{/* 카드 래퍼 끝 */}
      </div>{/* 스크롤 레이어 끝 */}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SwipeCompareCard — 탭 버튼 + 좌우 스와이프로 소스 전환
// ══════════════════════════════════════════════════════════════════════════
function SwipeCompareCard({ title, sources, theme }) {
  const [active, setActive] = useState(0);
  const [dir, setDir]       = useState(1); // +1 = 앞으로, -1 = 뒤로

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

      {/* 제목 + 소스 탭 */}
      <div className="px-4 pt-4 pb-3">
        <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>{title}</p>
        <div className="flex gap-1.5">
          {sources.map((s, i) => (
            <button
              key={s.name}
              onClick={() => goTo(i)}
              className="flex-1 py-1.5 rounded-2xl text-xs font-bold transition-all duration-200"
              style={{
                background: i === active
                  ? "rgba(255,255,255,0.65)"
                  : "rgba(0,0,0,0.07)",
                color: i === active ? theme.text : theme.sub,
                boxShadow: i === active ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
              }}
            >
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
          {/* 관측 시각 */}
          {src.obs && (
            <p className="text-[10px] mb-2" style={{ color: theme.sub, opacity: 0.65 }}>
              {src.obs.split(" (")[0]}
            </p>
          )}

          {/* 데이터 행 */}
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

          {/* 페이지 인디케이터 (소스 2개 이상) */}
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
// HourlyForecastCard — 탭 + 스와이프로 소스 전환, 5개 행 표시
// ══════════════════════════════════════════════════════════════════════════
const HOURLY_ROWS = [
  { key: "temp",       label: "온도",     fmt: (v) => v != null ? `${Number(v).toFixed(1)}°` : "—" },
  { key: "condition",  label: "날씨",     fmt: (v) => v || "—" },
  { key: "rainChance", label: "강수%",    fmt: (v) => v != null ? `${v}%` : "—" },
  { key: "humidity",   label: "습도",     fmt: (v) => v != null && v !== 0 ? `${v}%` : "—" },
  { key: "wind",       label: "바람",     fmt: (v) => v != null && v !== 0 ? `${Number(v).toFixed(1)}` : "—" },
];

function HourlyForecastCard({ hourSlots, alignedHourly, theme }) {
  const [active, setActive] = useState(0);
  const [dir, setDir]       = useState(1);

  const sources = [
    { name: "기상청",     freq: "1h", data: alignedHourly?.kma },
    { name: "OW",         freq: "3h", data: alignedHourly?.ow },
    { name: "Open-Meteo", freq: "1h", data: alignedHourly?.meteo },
  ].filter(s => s.data?.some(d => d != null));

  const goTo = (i) => {
    if (i === active) return;
    setDir(i > active ? 1 : -1);
    setActive(i);
  };

  const handleDragEnd = (_, info) => {
    if (info.offset.x < -50 && active < sources.length - 1) goTo(active + 1);
    else if (info.offset.x > 50 && active > 0) goTo(active - 1);
  };

  if (!sources.length) return null;
  const src = sources[active];

  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: theme.card }}>

      {/* 제목 + 소스 탭 */}
      <div className="px-4 pt-4 pb-3">
        <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>시간대별 예보</p>
        <div className="flex gap-1.5">
          {sources.map((s, i) => (
            <button
              key={s.name}
              onClick={() => goTo(i)}
              className="flex-1 py-1.5 rounded-2xl text-xs font-bold transition-all duration-200"
              style={{
                background: i === active ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.07)",
                color: i === active ? theme.text : theme.sub,
                boxShadow: i === active ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* 슬라이드 가능한 시간축 그리드 */}
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
          className="select-none"
        >
          {/* 주기 표시 */}
          <p className="text-[9px] px-4 mb-2" style={{ color: theme.sub, opacity: 0.6 }}>
            현재 기준 24시간 · {src.freq} 간격
          </p>

          {/* 가로 스크롤 그리드 */}
          <div className="overflow-x-auto pb-4 px-4" style={{ scrollbarWidth: "none" }}>
            <div style={{ minWidth: 44 + 24 * 44 }}>

              {/* 행 레이블 열 + 시간 헤더 */}
              <div className="flex mb-1">
                {/* 빈 레이블 셀 */}
                <div className="flex-shrink-0" style={{ width: 44 }} />
                {(hourSlots || []).map((s, i) => (
                  <div key={i} className="flex-shrink-0 text-center" style={{ width: 44 }}>
                    <p className="text-[10px] font-semibold"
                      style={{ color: theme.sub, opacity: s.isMidnight ? 1 : 0.65 }}>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* 구분선 */}
              <div className="mb-2" style={{ height: 1, background: `rgba(0,0,0,0.07)`, marginLeft: 44 }} />

              {/* 데이터 행 (온도 / 날씨 / 강수% / 습도 / 바람) */}
              {HOURLY_ROWS.map((row, rowIdx) => (
                <div key={row.key} className="flex items-center"
                  style={{ marginBottom: rowIdx < HOURLY_ROWS.length - 1 ? 6 : 0 }}>
                  {/* 행 레이블 */}
                  <div className="flex-shrink-0 flex items-center" style={{ width: 44 }}>
                    <p className="text-[9px] font-semibold" style={{ color: theme.sub, opacity: 0.75 }}>
                      {row.label}
                    </p>
                  </div>

                  {/* 데이터 셀 */}
                  {(src.data || []).map((item, colIdx) => {
                    const val = item ? row.fmt(item[row.key]) : null;
                    const isFilled = item?._filled;
                    return (
                      <div key={colIdx} className="flex-shrink-0 text-center rounded-md py-0.5"
                        style={{
                          width: 44,
                          opacity: isFilled ? 0.5 : 1,
                        }}>
                        {val != null ? (
                          <p className={`text-[10px] ${row.key === "temp" ? "font-bold" : "font-medium"}`}
                            style={{ color: row.key === "temp" ? theme.text : theme.sub }}>
                            {val}
                          </p>
                        ) : (
                          <p className="text-[10px]" style={{ color: theme.sub, opacity: 0.2 }}>·</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

            </div>
          </div>

          {/* 페이지 인디케이터 */}
          {sources.length > 1 && (
            <div className="flex justify-center gap-1.5 pb-4">
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

// ── 보조 컴포넌트들 ────────────────────────────────────────────────────────

function Metric({ icon, label, value, sub, text }) {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-1" style={{ color: sub }}>{icon}</div>
      <p className="text-xs" style={{ color: sub }}>{label}</p>
      <p className="font-bold text-sm mt-0.5" style={{ color: text }}>{value}</p>
    </div>
  );
}

function AirCard({ label, value, grade, sub }) {
  const { dotColor, label: gradeLabel } = gradeInfo(grade);
  return (
    <div className="text-center">
      <p className="text-xs" style={{ color: sub }}>{label}</p>
      <div className="flex justify-center mt-1">
        <AirDot color={dotColor} size={36} />
      </div>
      <p className="text-xs font-bold mt-0.5" style={{ color: "#000000" }}>{gradeLabel}</p>
      <p className="text-[10px] mt-0.5" style={{ color: sub }}>{value !== "-" ? `${value}㎍/㎥` : "-"}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// WeatherHistoryCard — 최근 3일치 시간별 기상 이력
// ══════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════
// ForecastHistoryCard — 그제/어제/오늘 저장된 예보 스와이프 비교
// ══════════════════════════════════════════════════════════════════════════
function ForecastHistoryCard({ history, theme }) {
  const [active, setActive] = useState(0);
  const [dir, setDir]       = useState(1);

  const goTo = (i) => {
    if (i === active) return;
    setDir(i > active ? 1 : -1);
    setActive(i);
  };

  const handleDragEnd = (_, info) => {
    if (info.offset.x < -50 && active < history.length - 1) goTo(active + 1);
    else if (info.offset.x > 50 && active > 0) goTo(active - 1);
  };

  const today     = new Date().toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });

  const tabLabel = (snap) => {
    if (!snap.dayKey) return "—";
    if (snap.dayKey === today) return "오늘 예보";
    if (snap.dayKey === yesterday) return "어제 예보";
    return snap.dayKey.replace(/\(.+\)/, "").trim() + " 예보";
  };

  const snap = history[active];
  if (!snap) return null;

  const savedTime = (() => {
    const d = new Date(snap.savedAt);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} 기준`;
  })();

  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: theme.card }}>

      {/* 제목 + 탭 */}
      <div className="px-4 pt-4 pb-3">
        <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>예보 이력</p>
        <div className="flex gap-1.5">
          {history.map((s, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="flex-1 py-1.5 rounded-2xl text-xs font-bold transition-all duration-200"
              style={{
                background: i === active ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.07)",
                color: i === active ? theme.text : theme.sub,
                boxShadow: i === active ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
              }}
            >
              {tabLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {/* 슬라이드 컨텐츠 */}
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
          {/* 저장 시각 */}
          <p className="text-[10px] mb-3" style={{ color: theme.sub, opacity: 0.65 }}>
            {savedTime} 저장된 예보
          </p>

          {/* 예보 행 */}
          {(snap.dailySummary || []).map((day, idx) => (
            <div key={day.dateLabel} className="flex items-center py-2"
              style={{ borderBottom: idx < snap.dailySummary.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none" }}>
              {/* 날짜 */}
              <p className="text-xs font-medium flex-1" style={{ color: theme.text }}>
                {day.dateLabel}
              </p>
              {/* 강수확률 */}
              <p className="text-xs w-10 text-right" style={{ color: theme.sub }}>
                비 {day.rainChance}%
              </p>
              {/* 최저 / 최고 */}
              <p className="text-xs font-semibold w-24 text-right" style={{ color: theme.text }}>
                {day.min != null ? `${Number(day.min).toFixed(1)}°` : "—"}
                {" / "}
                {day.max != null ? `${Number(day.max).toFixed(1)}°` : "—"}
              </p>
            </div>
          ))}

          {/* 인디케이터 */}
          {history.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-4">
              {history.map((_, i) => (
                <motion.div key={i}
                  animate={{ width: i === active ? 20 : 6 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-full"
                  style={{ height: 6, background: i === active ? theme.sub : `${theme.sub}55` }}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function WeatherHistoryCard({ history, theme }) {
  // savedAt 기준 내림차순 (최신 먼저)
  const sorted = [...history].sort((a, b) => b.savedAt - a.savedAt);

  // 날짜별로 그룹핑
  const groups = [];
  const seen = new Set();
  sorted.forEach((snap) => {
    if (!snap?.current || !snap.savedAt) return;
    const d = new Date(snap.savedAt);
    const dateKey = d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
    const hourKey = `${snap.savedAt}-${dateKey}-${d.getHours()}`;
    if (seen.has(hourKey)) return; // 같은 시간대 중복 제거
    seen.add(hourKey);

    const last = groups[groups.length - 1];
    if (!last || last.dateKey !== dateKey) {
      groups.push({ dateKey, items: [{ snap, d }] });
    } else {
      last.items.push({ snap, d });
    }
  });

  const today    = new Date().toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });

  const dayLabel = (key) => {
    if (key === today) return "오늘";
    if (key === yesterday) return "어제";
    return key;
  };

  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: theme.card }}>
      <div className="px-4 pt-4 pb-3">
        <p className="text-xs font-semibold" style={{ color: theme.sub }}>최근 기상 기록</p>
        <p className="text-[9px] mt-0.5" style={{ color: theme.sub, opacity: 0.65 }}>
          기상청 · 앱 접속 시 자동 저장 · 최근 3일
        </p>
      </div>

      <div className="pb-4">
        {groups.map(({ dateKey, items }) => (
          <div key={dateKey}>
            {/* 날짜 구분선 */}
            <div className="flex items-center gap-2 px-4 py-1.5">
              <div className="flex-1 h-px" style={{ background: `${theme.sub}30` }} />
              <p className="text-[10px] font-bold" style={{ color: theme.sub }}>{dayLabel(dateKey)}</p>
              <div className="flex-1 h-px" style={{ background: `${theme.sub}30` }} />
            </div>

            {/* 시간별 항목 */}
            {items.map(({ snap, d }, idx) => {
              const c = snap.current;
              const hh = String(d.getHours()).padStart(2, "0");
              const mm = String(d.getMinutes()).padStart(2, "0");
              return (
                <div key={idx}
                  className="flex items-center px-4 py-2"
                  style={{ borderBottom: idx < items.length - 1 ? `1px solid ${theme.sub}15` : "none" }}
                >
                  {/* 시각 */}
                  <p className="text-xs font-bold w-12 flex-shrink-0" style={{ color: theme.sub }}>
                    {hh}:{mm}
                  </p>
                  {/* 온도 */}
                  <p className="text-sm font-bold w-16 flex-shrink-0" style={{ color: theme.text }}>
                    {Number(c.temp).toFixed(1)}°
                  </p>
                  {/* 날씨 */}
                  <p className="text-xs flex-1 truncate" style={{ color: theme.sub }}>
                    {c.condition}
                  </p>
                  {/* 습도·바람 */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className="text-[10px]" style={{ color: theme.sub, opacity: 0.75 }}>
                      💧{c.humidity}%
                    </p>
                    <p className="text-[10px]" style={{ color: theme.sub, opacity: 0.75 }}>
                      🌬️{Number(c.wind).toFixed(1)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {groups.length === 0 && (
          <p className="text-xs text-center py-4" style={{ color: theme.sub, opacity: 0.5 }}>
            아직 저장된 기록이 없어요
          </p>
        )}
      </div>
    </div>
  );
}

function MeteoExtraCard({ meteo, theme }) {
  const items = [
    { label: "일출",     value: meteo.sunrise    ?? "—" },
    { label: "일몰",     value: meteo.sunset     ?? "—" },
    { label: "일조",     value: meteo.sunshineDuration ?? "—" },
    { label: "자외선",   value: meteo.uvIndex != null ? `${meteo.uvIndex.toFixed(1)} (${meteo.uvLevel})` : "—" },
    { label: "가시거리", value: meteo.visibility != null ? `${(meteo.visibility / 1000).toFixed(1)}km` : "—" },
    { label: "기압",     value: meteo.pressureMsl != null ? `${Math.round(meteo.pressureMsl)}hPa` : "—" },
    { label: "풍향",     value: meteo.windDirLabel ?? "—" },
    { label: "돌풍",     value: meteo.windGust != null ? `${Number(meteo.windGust).toFixed(1)}m/s` : "—" },
    { label: "운량",     value: meteo.cloudCover != null ? `${meteo.cloudCover}%` : "—" },
    { label: "이슬점",   value: meteo.dewPoint != null ? `${Math.round(meteo.dewPoint)}°` : "—" },
  ];

  return (
    <div className="rounded-3xl p-4" style={{ background: theme.card }}>
      <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>상세 기상 (Open-Meteo)</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {items.map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center py-1"
            style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            <span className="text-xs" style={{ color: theme.sub }}>{label}</span>
            <span className="text-xs font-semibold" style={{ color: theme.text }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
