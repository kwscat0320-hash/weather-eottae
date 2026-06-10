import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";

/** pull 인디케이터 — 스크롤 컨테이너 안 최상단에 렌더 */
export function PullIndicator({ pullDist, PULL_THRESHOLD }) {
  if (pullDist <= 0) return null;
  return (
    <div
      className="absolute top-0 left-0 right-0 flex justify-center z-30 pointer-events-none"
      style={{ transform: `translateY(${Math.min(pullDist * 0.5, 36)}px)`, transition: "none" }}
    >
      <div
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold"
        style={{
          background: "rgba(0,0,0,0.45)",
          color: "#fff",
          opacity: Math.min(pullDist / PULL_THRESHOLD, 1),
        }}
      >
        <RefreshCw
          size={13}
          style={{
            transform: `rotate(${pullDist * 3}deg)`,
            color: pullDist >= PULL_THRESHOLD ? "#4ade80" : "#fff",
          }}
        />
        {pullDist >= PULL_THRESHOLD ? "놓으면 새로고침" : "당겨서 새로고침"}
      </div>
    </div>
  );
}

/** 완료 토스트 — 페이지 루트(relative)에 absolute로 띄움 */
export function RefreshToast({ show }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="toast"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.22 }}
          className="absolute inset-x-0 top-0 bottom-0 flex items-center justify-center z-50 pointer-events-none"
        >
          <div
            className="px-5 py-3 rounded-2xl text-sm font-semibold"
            style={{
              background: "rgba(15,23,42,0.82)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              color: "#fff",
              boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
            }}
          >
            최신 데이터로 업데이트 되었습니다.
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
