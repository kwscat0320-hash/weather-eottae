import React, { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

const GUIDE_STORAGE_KEY = "action_guide_enabled_v1";
const ALL_GUIDES = [
  { key: "umbrella", label: "우산 챙길까?",       emoji: "☂️" },
  { key: "laundry",  label: "빨래해도 될까?",     emoji: "🧺" },
  { key: "running",  label: "산책/러닝 가능할까?", emoji: "🏃" },
  { key: "outfit",   label: "옷차림 어떻게?",     emoji: "👕" },
  { key: "forecast", label: "예보 믿어도 될까?",  emoji: "📡" },
];

function loadEnabled() {
  try {
    const raw = localStorage.getItem(GUIDE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  // 기본값: 전체 활성
  return ALL_GUIDES.map(g => g.key);
}

export default function SettingsPage({ scrollRef }) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [enabled, setEnabled] = useState(loadEnabled);

  const toggle = (key) => {
    const next = enabled.includes(key)
      ? enabled.filter(k => k !== key)
      : [...enabled, key];
    setEnabled(next);
    localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(next));
  };

  return (
    <div
      ref={scrollRef}
      className="flex-1 flex flex-col overflow-y-auto"
      style={{ background: "#f1f5f9", fontFamily: "Inter, sans-serif", scrollbarWidth: "none" }}
    >
      {/* 헤더 */}
      <div className="px-6 pt-12 pb-4" style={{ background: "#0f172a" }}>
        <p className="text-xs text-slate-400 mb-1">환경설정</p>
        <h1 className="text-white text-xl font-bold">설정</h1>
      </div>

      <div className="px-4 py-6 pb-32 space-y-3">

        {/* 행동 가이드 섹션 */}
        <div className="rounded-2xl bg-white overflow-hidden">
          {/* 메뉴 행 */}
          <button
            onClick={() => setGuideOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-4"
            style={{ background: "none", border: "none", cursor: "pointer" }}
          >
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 20 }}>🧭</span>
              <div style={{ textAlign: "left" }}>
                <p className="text-sm font-bold text-slate-800">행동 가이드</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  홈 화면에 표시할 가이드 선택
                  {enabled.length < ALL_GUIDES.length && ` (${enabled.length}개 활성)`}
                </p>
              </div>
            </div>
            {guideOpen
              ? <ChevronDown size={18} className="text-slate-400" />
              : <ChevronRight size={18} className="text-slate-400" />
            }
          </button>

          {/* 펼침 — 가이드 목록 */}
          {guideOpen && (
            <div style={{ borderTop: "1px solid #f1f5f9" }}>
              <p className="text-xs text-slate-400 px-5 pt-3 pb-2">
                복수 선택 가능 · 홈 화면에 즉시 반영됩니다
              </p>
              {ALL_GUIDES.map((g, idx) => {
                const on = enabled.includes(g.key);
                return (
                  <button
                    key={g.key}
                    onClick={() => toggle(g.key)}
                    className="w-full flex items-center justify-between px-5 py-3"
                    style={{
                      background: on ? "#f0fdf4" : "none",
                      border: "none", cursor: "pointer",
                      borderTop: idx > 0 ? "1px solid #f1f5f9" : "none",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span style={{ fontSize: 18 }}>{g.emoji}</span>
                      <p className="text-sm font-semibold text-slate-700">{g.label}</p>
                    </div>
                    {/* 토글 */}
                    <div
                      style={{
                        width: 44, height: 26, borderRadius: 13,
                        background: on ? "#10B981" : "#cbd5e1",
                        position: "relative", flexShrink: 0,
                        transition: "background 0.2s",
                      }}
                    >
                      <div
                        style={{
                          width: 20, height: 20,
                          borderRadius: "50%", background: "#fff",
                          position: "absolute", top: 3,
                          left: on ? 21 : 3,
                          transition: "left 0.2s",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }}
                      />
                    </div>
                  </button>
                );
              })}

              {/* 전체 선택 / 해제 */}
              <div className="flex gap-2 px-5 py-3" style={{ borderTop: "1px solid #f1f5f9" }}>
                <button
                  onClick={() => {
                    const all = ALL_GUIDES.map(g => g.key);
                    setEnabled(all);
                    localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(all));
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold"
                  style={{ background: "#e2e8f0", color: "#475569", border: "none", cursor: "pointer" }}
                >
                  전체 선택
                </button>
                <button
                  onClick={() => {
                    setEnabled([]);
                    localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify([]));
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold"
                  style={{ background: "#fee2e2", color: "#991b1b", border: "none", cursor: "pointer" }}
                >
                  전체 해제
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 추후 추가될 설정들 자리 */}
        <div className="rounded-2xl p-5 bg-white text-center">
          <p className="text-slate-400 text-sm">추가 설정 항목이 생길 예정입니다.</p>
        </div>

      </div>
    </div>
  );
}
