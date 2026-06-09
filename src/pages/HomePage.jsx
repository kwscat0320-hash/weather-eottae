import React from "react";
import { motion } from "framer-motion";
import { MapPin, RefreshCw, Droplets, Wind, Umbrella } from "lucide-react";
import { useWeather } from "../context/WeatherContext";
import { gradeInfo } from "../utils/weather";

export default function HomePage() {
  const {
    weather, theme, speech, todayForecasts, dailyForecasts,
    compareWeather, displayLocation, loading, error,
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

        {/* 기상청 vs OpenWeather 비교 */}
        {compareWeather && <CompareCard kma={weather} ow={compareWeather} theme={theme} />}
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
  const { img, color, label: gradeLabel } = gradeInfo(grade);
  return (
    <div className="text-center">
      <p className="text-xs" style={{ color: sub }}>{label}</p>
      <img src={img} alt={gradeLabel} className="w-10 h-10 mx-auto mt-1 object-contain" style={{ mixBlendMode: "multiply" }} />
      <p className="text-xs font-bold mt-0.5" style={{ color }}>{gradeLabel}</p>
      <p className="text-[10px] mt-0.5" style={{ color: sub }}>{value !== "-" ? `${value}㎍/㎥` : "-"}</p>
    </div>
  );
}

function CompareCard({ kma, ow, theme }) {
  const rows = [
    { label: "날씨",    kmaVal: kma.condition,                         owVal: ow.condition },
    { label: "기온",    kmaVal: `${Math.round(kma.temp)}°`,            owVal: `${Math.round(ow.temp)}°` },
    { label: "체감",    kmaVal: `${Math.round(kma.feelsLike)}°`,       owVal: `${Math.round(ow.feelsLike)}°` },
    { label: "오늘 최고", kmaVal: `${Math.round(kma.high)}°`,          owVal: `${Math.round(ow.high)}°` },
    { label: "오늘 최저", kmaVal: `${Math.round(kma.low)}°`,           owVal: `${Math.round(ow.low)}°` },
    { label: "습도",    kmaVal: `${kma.humidity}%`,                    owVal: `${ow.humidity}%` },
    { label: "바람",    kmaVal: `${Number(kma.wind).toFixed(1)}m/s`,   owVal: `${Number(ow.wind).toFixed(1)}m/s` },
    { label: "강수확률", kmaVal: `${kma.rainChance}%`,                 owVal: `${ow.rainChance}%` },
  ];
  return (
    <div className="rounded-3xl p-4" style={{ background: theme.card }}>
      <p className="text-xs font-semibold mb-1" style={{ color: theme.sub }}>기상청 vs OpenWeather 비교</p>
      {(kma.observedAt || ow.observedAt) && (
        <p className="text-[10px] mb-3" style={{ color: theme.sub }}>
          {kma.observedAt && <span>기상청 {kma.observedAt}</span>}
          {kma.observedAt && ow.observedAt && <span> · </span>}
          {ow.observedAt && <span>OW {ow.observedAt}</span>}
        </p>
      )}
      <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs">
        <div className="font-semibold" style={{ color: theme.sub }} />
        <div className="font-semibold text-center" style={{ color: theme.sub }}>기상청</div>
        <div className="font-semibold text-center" style={{ color: theme.sub }}>OpenWeather</div>
        {rows.map(({ label, kmaVal, owVal }) => (
          <React.Fragment key={label}>
            <div className="py-1" style={{ color: theme.sub }}>{label}</div>
            <div className="py-1 text-center font-medium" style={{ color: theme.text }}>{kmaVal}</div>
            <div className="py-1 text-center font-medium" style={{ color: theme.text }}>{owVal}</div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
