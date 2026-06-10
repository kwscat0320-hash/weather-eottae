import React from "react";
import { MapPin, Plus } from "lucide-react";
import { useWeather } from "../context/WeatherContext";

export default function FavoritesPage({ scrollRef }) {
  const { theme } = useWeather();

  return (
    <div ref={scrollRef} className={`flex-1 bg-gradient-to-b ${theme.bg} flex flex-col overflow-y-auto`}
      style={{ scrollbarWidth: "none" }}>
      <div className="px-6 pt-10 pb-4">
        <p className="text-xs mb-1" style={{ color: theme.sub }}>관심지역</p>
        <h1 className="text-xl font-bold" style={{ color: theme.text }}>저장한 지역</h1>
        <p className="text-xs mt-1" style={{ color: theme.sub }}>자주 확인하는 지역 날씨를 한눈에</p>
      </div>

      <div className="px-4 py-2 pb-32">
        {/* placeholder — 다음 작업에서 검색/추가/목록 구현 */}
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
            <Plus size={20} style={{ color: theme.text }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: theme.text }}>지역 추가하기</p>
          <p className="text-[10px]" style={{ color: theme.sub }}>도시명 검색 (준비 중)</p>
        </button>

        <div className="mt-4 rounded-2xl p-4 text-center" style={{ background: theme.card }}>
          <MapPin size={20} className="mx-auto mb-2" style={{ color: theme.sub }} />
          <p className="text-xs" style={{ color: theme.sub }}>아직 저장한 관심지역이 없어요</p>
        </div>
      </div>
    </div>
  );
}
