import React from "react";
import { motion } from "framer-motion";
import { MapPin, RefreshCw, Droplets, Wind, Umbrella } from "lucide-react";
import { useWeather } from "../context/WeatherContext";
import { gradeInfo } from "../utils/weather";
import AirDot from "../components/AirDot";

export default function HomePage() {
  const {
    weather, theme, speech, todayForecasts, dailyForecasts,
    compareWeather, meteoWeather, displayLocation, loading, error,
    coords, requestCurrentLocation, air,
  } = useWeather();

  const dateStr = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });

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

  return (
    <div className={`flex-1 bg-gradient-to-b ${theme.bg} flex flex-col`}>
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
      <div className="flex items-end px-6 pt-4 pb-2">
        <div className="flex-1">
          <p className="text-xl font-semibold" style={{ color: theme.text }}>{weather?.condition}</p>
          <p className="text-xs font-semibold mt-1" style={{ color: theme.sub }}>현재온도</p>
          <div className="font-bold leading-none mt-0.5" style={{ fontSize: 72, color: theme.text }}>{weather?.temp}°</div>
          <p className="text-sm mt-2" style={{ color: theme.sub }}>
            최고 {weather?.high}° / 최저 {weather?.low}° · 체감 {weather?.feelsLike}°
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

      {/* 카드들 */}
      <div className="px-4 pb-32 space-y-3 mt-2">
        {/* 요약 카드 */}
        <div className="rounded-3xl p-4" style={{ background: theme.card }}>
          <div className="grid grid-cols-3 gap-3">
            <Metric icon={<Droplets size={18} />} label="습도" value={`${weather?.humidity}%`} sub={theme.sub} text={theme.text} />
            <Metric icon={<Wind size={18} />} label="풍속" value={`${Number(weather?.wind).toFixed(1)}m/s`} sub={theme.sub} text={theme.text} />
            <Metric icon={<Umbrella size={18} />} label="강수" value={`${weather?.rainChance}%`} sub={theme.sub} text={theme.text} />
          </div>
          {air && (
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3" style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
              <AirCard label="미세먼지" value={air.pm10} grade={air.pm10Grade} sub={theme.sub} />
              <AirCard label="초미세먼지" value={air.pm25} grade={air.pm25Grade} sub={theme.sub} />
            </div>
          )}
        </div>

        {/* 시간대별 예보 */}
        <div className="rounded-3xl p-4" style={{ background: theme.card }}>
          <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>시간대별 예보</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {todayForecasts.map((item) => (
              <div key={`${item.dateLabel}-${item.timeLabel}`}
                className="flex-shrink-0 rounded-2xl p-2 text-center"
                style={{ width: 64, height: 75, background: "rgba(255,254,254,0.3)" }}>
                <p className="text-[11px]" style={{ color: theme.sub }}>{item.timeLabel}</p>
                <p className="font-bold text-sm mt-2" style={{ color: theme.text }}>{Math.round(item.temp)}°</p>
                <p className="text-[10px] mt-1" style={{ color: theme.sub }}>비 {item.rainChance}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* 기상청 5일 예보 */}
        <div className="rounded-3xl p-4" style={{ background: theme.card }}>
          <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>기상청 5일 예보</p>
          <div className="space-y-3">
            {dailyForecasts.map((day) => (
              <div key={day.date} className="flex items-center justify-between">
                <p className="text-sm font-medium w-28" style={{ color: theme.text }}>{day.date}</p>
                <p className="text-xs" style={{ color: theme.sub }}>비 {day.rainChance}%</p>
                <p className="text-sm font-semibold" style={{ color: theme.text }}>{Math.round(day.min)}° / {Math.round(day.max)}°</p>
              </div>
            ))}
          </div>
        </div>

        {/* 날씨 소스 비교 */}
        {compareWeather && (
          <CompareCard
            kma={weather}
            ow={compareWeather}
            meteo={meteoWeather}
            theme={theme}
          />
        )}
      </div>
    </div>
  );
}

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
      <p className="text-xs font-bold mt-0.5" style={{ color: dotColor }}>{gradeLabel}</p>
      <p className="text-[10px] mt-0.5" style={{ color: sub }}>{value !== "-" ? `${value}㎍/㎥` : "-"}</p>
    </div>
  );
}

function CompareCard({ kma, ow, meteo, theme }) {
  const rows = [
    { label: "날씨" },
    { label: "기온" },
    { label: "체감" },
    { label: "오늘 최고" },
    { label: "오늘 최저" },
    { label: "습도" },
    { label: "바람" },
    { label: "강수확률" },
  ];

  const sources = [
    {
      name: "기상청",
      obs: kma.observedAt,
      vals: [
        kma.condition,
        `${Math.round(kma.temp)}°`,
        `${Math.round(kma.feelsLike)}°`,
        `${Math.round(kma.high)}°`,
        `${Math.round(kma.low)}°`,
        `${kma.humidity}%`,
        `${Number(kma.wind).toFixed(1)}m/s`,
        `${kma.rainChance}%`,
      ],
    },
    {
      name: "OpenWeather",
      obs: ow.observedAt,
      vals: [
        ow.condition,
        `${Math.round(ow.temp)}°`,
        `${Math.round(ow.feelsLike)}°`,
        `${Math.round(ow.high)}°`,
        `${Math.round(ow.low)}°`,
        `${ow.humidity}%`,
        `${Number(ow.wind).toFixed(1)}m/s`,
        `${ow.rainChance}%`,
      ],
    },
    ...(meteo ? [{
      name: "Open-Meteo",
      obs: meteo.observedAt,
      vals: [
        meteo.condition,
        `${Math.round(meteo.temp)}°`,
        `${Math.round(meteo.feelsLike)}°`,
        `${Math.round(meteo.high)}°`,
        `${Math.round(meteo.low)}°`,
        `${meteo.humidity}%`,
        `${Number(meteo.wind).toFixed(1)}m/s`,
        `${meteo.rainChance}%`,
      ],
    }] : []),
  ];

  return (
    <div className="rounded-3xl p-4" style={{ background: theme.card }}>
      <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>날씨 소스 비교</p>

      {/* 횡 스크롤 테이블 */}
      <div className="overflow-x-auto -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
        <div style={{ minWidth: sources.length > 2 ? 320 : "auto" }}>
          {/* 헤더 */}
          <div className="flex text-xs mb-2">
            <div className="w-16 flex-shrink-0" />
            {sources.map(s => (
              <div key={s.name} className="flex-1 text-center font-semibold min-w-[72px]" style={{ color: theme.sub }}>
                {s.name}
              </div>
            ))}
          </div>

          {/* 관측 시각 */}
          <div className="flex text-[9px] mb-3">
            <div className="w-16 flex-shrink-0" />
            {sources.map(s => (
              <div key={s.name} className="flex-1 text-center min-w-[72px]" style={{ color: theme.sub, opacity: 0.7 }}>
                {s.obs ? s.obs.split(" (")[0] : ""}
              </div>
            ))}
          </div>

          {/* 데이터 행 */}
          {rows.map((row, i) => (
            <div key={row.label} className="flex text-xs py-1" style={{ borderTop: i > 0 ? `1px solid rgba(0,0,0,0.06)` : "none" }}>
              <div className="w-16 flex-shrink-0" style={{ color: theme.sub }}>{row.label}</div>
              {sources.map(s => (
                <div key={s.name} className="flex-1 text-center font-medium min-w-[72px]" style={{ color: theme.text }}>
                  {s.vals[i]}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
