import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import {
  getUmbrellaDecision,
  getLaundryDecision,
  getRunningDecision,
  getOutfitDecision,
  getForecastConfidence,
} from "../utils/decisions";

const GUIDE_STORAGE_KEY = "action_guide_enabled_v1";
const ALL_KEYS = ["umbrella", "laundry", "running", "outfit", "forecast"];

function loadEnabledKeys() {
  try {
    const raw = localStorage.getItem(GUIDE_STORAGE_KEY);
    if (raw !== null) return JSON.parse(raw); // 저장된 값 사용 (빈 배열 포함)
  } catch {}
  return null; // 한 번도 설정 안 한 상태
}

// ── 상태별 스타일 ──────────────────────────────────────────────────────────
const STATUS = {
  good:    { label: "좋음", bg: "#D1FAE5", text: "#065F46", dot: "#10B981", bar: "#10B981" },
  normal:  { label: "보통", bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6", bar: "#3B82F6" },
  warning: { label: "주의", bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B", bar: "#F59E0B" },
  bad:     { label: "비추", bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444", bar: "#EF4444" },
};

const ICONS = {
  "우산 챙길까?":       "☂️",
  "빨래해도 될까?":     "🧺",
  "산책/러닝 가능할까?":"🏃",
  "옷차림 어떻게?":     "👕",
  "예보 믿어도 될까?":  "📡",
};

// ── 상세 모달 ─────────────────────────────────────────────────────────────
// createPortal로 body에 직접 마운트 → framer-motion transform 부모 영향 없음
function DetailModal({ decision, onClose, theme }) {
  const st = STATUS[decision.status] || STATUS.normal;
  const controls = useAnimation();

  useEffect(() => {
    controls.start({ y: 0, transition: { type: "spring", damping: 32, stiffness: 340 } });
  }, []);

  const dismiss = async () => {
    await controls.start({ y: "100%", transition: { type: "tween", duration: 0.18, ease: "easeIn" } });
    onClose();
  };

  const handleDragEnd = (_, info) => {
    if (info.velocity.y > 400 || info.offset.y > 120) {
      dismiss();
    } else {
      controls.start({ y: 0, transition: { type: "spring", damping: 32, stiffness: 400 } });
    }
  };

  const content = (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        onClick={dismiss}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.25)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        }}
      />

      {/* 바텀 시트 */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.8 }}
        onDragEnd={handleDragEnd}
        animate={controls}
        initial={{ y: "100%" }}
        onClick={e => e.stopPropagation()}
        style={{
          position: "relative", zIndex: 1,
          width: "100%", maxWidth: "100%",
          background: theme.card,
          borderRadius: "28px 28px 0 0",
          padding: "28px 24px 52px",
          maxHeight: "88vh", overflowY: "auto",
          cursor: "grab",
        }}
      >
        {/* 핸들 */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: "rgba(0,0,0,0.15)", margin: "0 auto 20px",
        }} />

        {/* 제목 + 배지 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>
            {ICONS[decision.title]} {decision.title}
          </p>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
            background: st.bg, color: st.text,
          }}>{st.label}</span>
        </div>

        {/* 결론 */}
        <p style={{
          fontSize: 16, fontWeight: 700, color: st.dot,
          marginBottom: 16, paddingBottom: 16,
          borderBottom: "1px solid rgba(0,0,0,0.08)",
        }}>
          {decision.summary}
        </p>

        {/* 점수 바 */}
        {decision.score != null && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: theme.sub }}>점수</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: st.dot }}>{decision.score}점</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "rgba(0,0,0,0.08)" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, Math.min(100, decision.score))}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{ height: 8, borderRadius: 4, background: st.bar }}
              />
            </div>
          </div>
        )}

        {/* 판단 이유 */}
        {decision.reason?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: theme.sub, marginBottom: 8 }}>판단 이유</p>
            {decision.reason.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                <span style={{ color: st.dot, marginTop: 2, flexShrink: 0 }}>•</span>
                <span style={{ fontSize: 14, color: theme.text }}>{r}</span>
              </div>
            ))}
          </div>
        )}

        {/* 옷차림 아이템 */}
        {decision.items?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: theme.sub, marginBottom: 8 }}>추천 아이템</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {decision.items.map((item, i) => (
                <span key={i} style={{
                  fontSize: 12, padding: "4px 10px", borderRadius: 20,
                  background: `${st.dot}18`, color: st.text, fontWeight: 600,
                }}>{item}</span>
              ))}
            </div>
          </div>
        )}

        {/* 모델별 상세 (신뢰도) */}
        {decision.details?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: theme.sub, marginBottom: 8 }}>모델별 예보</p>
            {decision.details.map((d, i) => (
              <p key={i} style={{ fontSize: 13, color: theme.text, marginBottom: 4, opacity: 0.8 }}>{d}</p>
            ))}
          </div>
        )}

        {/* 판단 기준 */}
        {decision.criteria?.length > 0 && (
          <div style={{
            marginTop: 4, padding: "12px 14px", borderRadius: 14,
            background: "rgba(0,0,0,0.04)",
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: theme.sub, marginBottom: 6, opacity: 0.6 }}>
              판단 기준
            </p>
            {decision.criteria.map((c, i) => (
              <p key={i} style={{ fontSize: 11, color: theme.sub, marginBottom: 2, opacity: 0.7 }}>{c}</p>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );

  return createPortal(content, document.body);
}

// ── 개별 행동 카드 ────────────────────────────────────────────────────────
function ActionCard({ decision, theme, onClick }) {
  const st = STATUS[decision.status] || STATUS.normal;
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left",
        background: theme.card,
        borderRadius: 20, padding: "16px 16px 14px",
        border: "none", cursor: "pointer",
        borderLeft: `4px solid ${st.dot}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>{ICONS[decision.title]}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: theme.sub }}>{decision.title}</span>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
          background: st.bg, color: st.text, flexShrink: 0,
        }}>{st.label}</span>
      </div>

      <p style={{ fontSize: 15, fontWeight: 800, color: theme.text, marginBottom: 6 }}>
        {decision.summary}
      </p>

      {decision.reason?.slice(0, 1).map((r, i) => (
        <p key={i} style={{ fontSize: 12, color: theme.sub, opacity: 0.8, lineHeight: 1.4 }}>{r}</p>
      ))}

      <p style={{ fontSize: 11, color: st.dot, marginTop: 8, fontWeight: 600, opacity: 0.7 }}>
        자세히 보기 →
      </p>
    </motion.button>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────
export default function DecisionCards({ weather, air, compareWeather, meteoWeather, theme, onGoToSettings }) {
  const [openDecision, setOpenDecision] = useState(null);

  if (!weather) return null;

  const enabledKeys = loadEnabledKeys();

  // 미설정 상태(null) 또는 전체 해제(빈 배열) → 안내 버튼
  if (!enabledKeys || enabledKeys.length === 0) {
    return (
      <button
        onClick={onGoToSettings}
        style={{
          width: "100%", textAlign: "left",
          background: theme.card,
          borderRadius: 20, padding: "18px 20px",
          border: `1.5px dashed rgba(0,0,0,0.12)`,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🧭</span>
          <div style={{ textAlign: "left" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>행동가이드를 선택해주세요</p>
            <p style={{ fontSize: 11, color: theme.sub, marginTop: 2 }}>설정에서 원하는 가이드를 골라보세요</p>
          </div>
        </div>
        <span style={{ fontSize: 12, color: theme.sub, opacity: 0.6 }}>설정 →</span>
      </button>
    );
  }

  const all = {
    umbrella: getUmbrellaDecision(weather),
    laundry:  getLaundryDecision(weather),
    running:  getRunningDecision(weather, air),
    outfit:   getOutfitDecision(weather),
    forecast: getForecastConfidence(weather, compareWeather, meteoWeather),
  };

  const decisions = ALL_KEYS.filter(k => enabledKeys.includes(k)).map(k => all[k]);

  return (
    <>
      {/* 섹션 레이블 */}
      <p style={{ fontSize: 11, fontWeight: 700, color: theme.sub, opacity: 0.6,
        letterSpacing: "0.08em", paddingLeft: 4, paddingTop: 4 }}>
        행동 가이드
      </p>

      {/* 선택된 카드만 표시 */}
      {decisions.map((d) => (
        <ActionCard
          key={d.title}
          decision={d}
          theme={theme}
          onClick={() => setOpenDecision(d)}
        />
      ))}

      {/* 상세 모달 */}
      {openDecision && (
        <DetailModal
          decision={openDecision}
          onClose={() => setOpenDecision(null)}
          theme={theme}
        />
      )}
    </>
  );
}
