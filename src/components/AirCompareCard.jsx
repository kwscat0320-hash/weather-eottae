import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { gradeInfo } from "../utils/weather";

// ══════════════════════════════════════════════════════════════════════════
// AirCompareCard — 탭+스와이프, 소스별 도넛 차트 (미세먼지 / 초미세먼지)
// ══════════════════════════════════════════════════════════════════════════
export default function AirCompareCard({ air, airOw, airMeteo, theme }) {
  const [active, setActive] = useState(0);
  const [dir, setDir]       = useState(1);

  const sources = [
    ...(air ? [{ name: "에어코리아", color: "#2563eb",
      pm10:  { value: air.pm10,      grade: air.pm10Grade },
      pm25:  { value: air.pm25,      grade: air.pm25Grade },
      extra: air.stationName ? `측정소: ${air.stationName}` : null,
    }] : []),
    ...(airOw ? [{ name: "OpenWeather", color: "#ea580c",
      pm10:  { value: airOw.pm10,    grade: airOw.pm10Grade },
      pm25:  { value: airOw.pm25,    grade: airOw.pm25Grade },
      extra: airOw.no2 != null ? `NO₂: ${airOw.no2}㎍/㎥` : null,
    }] : []),
    ...(airMeteo ? [{ name: "Open-Meteo", color: "#059669",
      pm10:  { value: airMeteo.pm10, grade: airMeteo.pm10Grade },
      pm25:  { value: airMeteo.pm25, grade: airMeteo.pm25Grade },
      extra: null,
    }] : []),
  ];

  if (!sources.length) return null;

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

  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: theme.card }}>
      {/* 탭 */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex gap-1.5">
          {sources.map((s, i) => (
            <button key={s.name} onClick={() => goTo(i)}
              className="flex-1 py-1.5 rounded-2xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1"
              style={{
                background: i === active ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.07)",
                color: i === active ? (s.color ?? theme.text) : theme.sub,
                boxShadow: i === active ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
              }}>
              {i === active && (
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
              )}
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* 도넛 슬라이드 */}
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div key={active} custom={dir}
          variants={{
            enter:  (d) => ({ x: d * 48, opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit:   (d) => ({ x: d * -48, opacity: 0 }),
          }}
          initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.2, ease: "easeOut" }}
          drag="x" dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12} onDragEnd={handleDragEnd}
          className="px-6 pb-6 cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex justify-around items-center py-5">
            <BigAirDonut label="미세먼지"   value={src.pm10.value} grade={src.pm10.grade} maxScale={150} theme={theme} />
            <div style={{ width: 1, height: 130, background: "rgba(0,0,0,0.07)" }} />
            <BigAirDonut label="초미세먼지" value={src.pm25.value} grade={src.pm25.grade} maxScale={75}  theme={theme} />
          </div>

          {src.extra && (
            <p className="text-xs text-center" style={{ color: theme.sub, opacity: 0.6 }}>{src.extra}</p>
          )}

          {sources.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-5">
              {sources.map((_, i) => (
                <motion.div key={i} animate={{ width: i === active ? 20 : 6 }}
                  transition={{ duration: 0.25 }} className="rounded-full"
                  style={{ height: 6, background: i === active ? theme.sub : `${theme.sub}55` }} />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function BigAirDonut({ label, value, grade, maxScale, theme }) {
  const { dotColor, label: gradeLabel } = gradeInfo(grade);
  const numVal = (value !== "-" && value != null) ? Number(value) : 0;
  const pct    = Math.min(numVal / maxScale, 1);

  const R    = 54;
  const SW   = 12;
  const r    = R - SW / 2;
  const circ = 2 * Math.PI * r;
  const gap  = circ * 0.18;
  const full = circ - gap;
  const dash = full * pct;
  const size = R * 2 + SW;
  const rotate = 90 + (360 * 0.18) / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm font-semibold" style={{ color: theme.sub }}>{label}</p>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: `rotate(${rotate}deg)` }}>
          <circle cx={R} cy={R} r={r} fill="none"
            stroke="rgba(0,0,0,0.10)" strokeWidth={SW}
            strokeDasharray={`${full} ${gap}`} strokeLinecap="round" />
          <circle cx={R} cy={R} r={r} fill="none"
            stroke={dotColor} strokeWidth={SW}
            strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={0} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-base font-black leading-none" style={{ color: dotColor }}>{gradeLabel}</p>
          {numVal > 0 && (
            <p className="text-xs mt-1 font-semibold" style={{ color: theme.sub }}>{numVal}</p>
          )}
        </div>
      </div>
      <p className="text-xs font-medium" style={{ color: theme.sub, opacity: 0.7 }}>
        {numVal > 0 ? `${numVal}㎍/㎥` : "—"}
      </p>
    </div>
  );
}
