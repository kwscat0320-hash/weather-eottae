import React from "react";

export default function SettingsPage() {
  return (
    <div className="flex-1 flex flex-col" style={{ background: "#f1f5f9", fontFamily: "Inter, sans-serif" }}>
      <div className="px-6 pt-12 pb-4" style={{ background: "#0f172a" }}>
        <p className="text-xs text-slate-400 mb-1">환경설정</p>
        <h1 className="text-white text-xl font-bold">설정</h1>
      </div>

      <div className="px-4 py-6 pb-32 space-y-3">
        <div className="rounded-2xl p-5 bg-white text-center">
          <p className="text-slate-400 text-sm">설정 항목이 추가될 예정입니다.</p>
        </div>
      </div>
    </div>
  );
}
