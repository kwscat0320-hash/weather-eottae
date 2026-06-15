import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getUmbrellaDecision,
  getLaundryDecision,
  getRunningDecision,
  getOutfitDecision,
  getForecastConfidence,
  getTodaySummary,
} from "../utils/decisions";

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
function DetailModal({ decision, onClose, theme }) {
  const st = STATUS[decision.status] || STATUS.normal;
  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
        }}
      />
      <motion.div
        key="sheet"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
        style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 393, zIndex: 201,
          background: theme.card,
          borderRadius: "28px 28px 0 0",
          padding: "28px 24px 48px",
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
    </AnimatePresence>
  );
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

// ── 오늘의 결론 배너 ──────────────────────────────────────────────────────
function TodayConclusion({ text, theme }) {
  return (
    <div style={{
      background: theme.card,
      borderRadius: 20, padding: "16px 18px",
      borderLeft: "4px solid #6366F1",
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#6366F1", marginBottom: 6, opacity: 0.8 }}>
        💬 오늘의 결론
      </p>
      <p style={{ fontSize: 14, fontWeight: 600, color: theme.text, lineHeight: 1.6 }}>
        {text}
      </p>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────
export default function DecisionCards({ weather, air, compareWeather, meteoWeather, theme }) {
  const [openDecision, setOpenDecision] = useState(null);

  if (!weather) return null;

  const umbrella   = getUmbrellaDecision(weather);
  const laundry    = getLaundryDecision(weather);
  const running    = getRunningDecision(weather, air);
  const outfit     = getOutfitDecision(weather);
  const confidence = getForecastConfidence(weather, compareWeather, meteoWeather);
  const summary    = getTodaySummary(umbrella, laundry, running, outfit, confidence);

  const decisions = [umbrella, laundry, running, outfit, confidence];

  return (
    <>
      {/* 오늘의 결론 */}
      <TodayConclusion text={summary} theme={theme} />

      {/* 섹션 레이블 */}
      <p style={{ fontSize: 11, fontWeight: 700, color: theme.sub, opacity: 0.6,
        letterSpacing: "0.08em", paddingLeft: 4, paddingTop: 4 }}>
        행동 가이드
      </p>

      {/* 5개 카드 */}
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
