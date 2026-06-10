import { useEffect, useRef, useState } from "react";

const PULL_THRESHOLD = 72;

/**
 * pull-to-refresh + 완료 토스트
 * @param {React.RefObject} scrollRef  스크롤 컨테이너 ref
 * @param {Function} onRefresh         강제 새로고침 실행 함수
 * @param {boolean} loading            로딩 상태 (완료 감지용)
 * @returns {{ pullDist, PULL_THRESHOLD, showToast }}
 */
export function usePullToRefresh(scrollRef, onRefresh, loading) {
  const pullStartY   = useRef(null);
  const wasForceRef  = useRef(false);
  const [pullDist,   setPullDist]   = useState(0);
  const [showToast,  setShowToast]  = useState(false);

  // 터치 이벤트 — 최상단에서 아래로 당길 때만 활성
  useEffect(() => {
    const el = scrollRef?.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (el.scrollTop === 0) pullStartY.current = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      if (pullStartY.current === null) return;
      const dist = e.touches[0].clientY - pullStartY.current;
      if (dist > 0) setPullDist(Math.min(dist, PULL_THRESHOLD + 24));
    };
    const onTouchEnd = () => {
      if (pullDist >= PULL_THRESHOLD) {
        wasForceRef.current = true;
        onRefresh();
      }
      pullStartY.current = null;
      setPullDist(0);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove",  onTouchMove,  { passive: true });
    el.addEventListener("touchend",   onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove",  onTouchMove);
      el.removeEventListener("touchend",   onTouchEnd);
    };
  }, [scrollRef, pullDist, onRefresh]);

  // 로딩 완료 → 토스트
  useEffect(() => {
    if (!loading && wasForceRef.current) {
      wasForceRef.current = false;
      setShowToast(true);
      const t = setTimeout(() => setShowToast(false), 1500);
      return () => clearTimeout(t);
    }
  }, [loading]);

  return { pullDist, PULL_THRESHOLD, showToast };
}
