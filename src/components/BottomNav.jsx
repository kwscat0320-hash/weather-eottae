import React, { useEffect, useRef, useState } from "react";
import { Home, Navigation, Calendar, BarChart2, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TABS = [
  { id: "home",      label: "홈",   Icon: Home },
  { id: "detail",    label: "상세", Icon: BarChart2 },
  { id: "schedule",  label: "일정", Icon: Calendar },
  { id: "route",    label: "경로", Icon: Navigation },
  { id: "settings",  label: "설정", Icon: Settings },
];

export default function BottomNav({ current, onChange, scrollRef }) {
  const [hidden, setHidden] = useState(false);
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
        // 위로 스크롤하면 숨김, 아래로 스크롤하거나 최상단이면 표시
        if (y > lastY.current && y > 80) {
          setHidden(true);
        } else {
          setHidden(false);
        }
        lastY.current = y;
        ticking.current = false;
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  return (
    <motion.div
      className="fixed bottom-0 left-1/2 z-50"
      style={{ x: "-50%", width: "100%", maxWidth: 393 }}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: hidden ? 100 : 0, opacity: hidden ? 0 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div
        className="mx-3 mb-4 rounded-3xl flex items-center justify-around px-2 py-2"
        style={{
          background: "rgba(15, 23, 42, 0.82)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.06) inset",
        }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = current === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 flex-1"
              style={{
                background: active ? "rgba(255,255,255,0.14)" : "transparent",
                color: active ? "#ffffff" : "rgba(255,255,255,0.45)",
              }}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-semibold tracking-wide">{label}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
