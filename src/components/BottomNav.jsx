import React, { useEffect, useRef, useState } from "react";
import { Home, BarChart2, Settings } from "lucide-react";

const TABS = [
  { id: "home",   label: "홈",   Icon: Home },
  { id: "detail", label: "상세", Icon: BarChart2 },
  { id: "settings", label: "설정", Icon: Settings },
];

export default function BottomNav({ current, onChange, scrollRef }) {
  const [visible, setVisible] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const el = scrollRef?.current;
    if (!el) return;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = el.scrollTop;
        if (y > lastY.current && y > 40) {
          // 아래로 스크롤 → 내비 슬라이드업
          setVisible(true);
        } else if (y < lastY.current && y < 20) {
          // 최상단 근처로 돌아오면 숨김
          setVisible(false);
        }
        lastY.current = y;
        ticking.current = false;
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] z-50"
      style={{
        transform: `translateX(-50%) translateY(${visible ? "0%" : "110%"})`,
        transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
        willChange: "transform",
      }}
    >
      {/* 배경 블러 바 */}
      <div
        className="mx-3 mb-3 rounded-3xl flex items-center justify-around px-2 py-2"
        style={{
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.06) inset",
        }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = current === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="flex flex-col items-center gap-1 px-6 py-2 rounded-2xl transition-all duration-200"
              style={{
                background: active ? "rgba(255,255,255,0.12)" : "transparent",
                color: active ? "#ffffff" : "rgba(255,255,255,0.45)",
              }}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-semibold tracking-wide">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
