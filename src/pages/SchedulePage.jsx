import React from "react";
import { Calendar as CalendarIcon, Upload } from "lucide-react";
import { useWeather } from "../context/WeatherContext";

export default function SchedulePage({ scrollRef }) {
  const { theme } = useWeather();

  return (
    <div ref={scrollRef} className={`flex-1 bg-gradient-to-b ${theme.bg} flex flex-col overflow-y-auto`}
      style={{ scrollbarWidth: "none" }}>
      <div className="px-6 pt-10 pb-4">
        <p className="text-xs mb-1" style={{ color: theme.sub }}>일정</p>
        <h1 className="text-xl font-bold" style={{ color: theme.text }}>일정별 날씨</h1>
        <p className="text-xs mt-1" style={{ color: theme.sub }}>달력에서 일정과 그날의 날씨를 한 번에</p>
      </div>

      <div className="px-4 py-2 pb-32">
        {/* placeholder — 다음 작업에서 달력 + ICS import + 날씨 매칭 구현 */}
        <button
          className="w-full rounded-2xl py-6 flex flex-col items-center justify-center gap-2"
          style={{
            background: theme.card,
            border: `1px dashed ${theme.sub}`,
            opacity: 0.85,
          }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.25)" }}
          >
            <Upload size={20} style={{ color: theme.text }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: theme.text }}>일정 가져오기</p>
          <p className="text-[10px]" style={{ color: theme.sub }}>웹 프로토타입: ICS 파일 (앱 출시 시 자동)</p>
        </button>

        <div className="mt-4 rounded-2xl p-6 text-center" style={{ background: theme.card }}>
          <CalendarIcon size={28} className="mx-auto mb-2" style={{ color: theme.sub }} />
          <p className="text-sm font-semibold mb-1" style={{ color: theme.text }}>달력 (준비 중)</p>
          <p className="text-[10px]" style={{ color: theme.sub }}>
            일정 추가 시 ☀️ ☁️ 🌧️ 이모지로 날씨가 표시돼요
          </p>
        </div>
      </div>
    </div>
  );
}
