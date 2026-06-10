import React from "react";

// ── 공통: 범례 ─────────────────────────────────────────────────────────────
export function ChartLegend({ sources, theme }) {
  return (
    <div className="flex gap-4 mb-4 flex-wrap">
      {sources.map(s => (
        <div key={s.name} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
          <span className="text-xs font-semibold" style={{ color: theme.sub }}>{s.name}</span>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TemperatureBarChart — 세로 막대 그래프 (기온/체감/최고/최저 × 3소스)
// ══════════════════════════════════════════════════════════════════════════
export function TemperatureBarChart({ weather, compareWeather, meteoWeather, theme }) {
  const sources = [
    { name: "기상청",     color: "#2563eb", w: weather },
    { name: "OW",         color: "#ea580c", w: compareWeather },
    ...(meteoWeather ? [{ name: "Open-Meteo", color: "#059669", w: meteoWeather }] : []),
  ].filter(s => s.w);

  const metrics = [
    { key: "temp",      label: "기온" },
    { key: "feelsLike", label: "체감" },
    { key: "high",      label: "최고" },
    { key: "low",       label: "최저" },
  ];

  const allVals = sources.flatMap(s => metrics.map(m => Number(s.w[m.key]) || 0));
  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const minVal = rawMin - (rawMax - rawMin) * 0.4 - 1;
  const maxVal = rawMax + 2;

  const W = 300, H = 190;
  const mTop = 22, mRight = 8, mBottom = 36, mLeft = 28;
  const chartW = W - mLeft - mRight;
  const chartH = H - mTop - mBottom;

  const n = sources.length;
  const groupCount = metrics.length;
  const groupGap = 14;
  const barGap = 2;
  const groupW = (chartW - (groupCount - 1) * groupGap) / groupCount;
  const barW = Math.max((groupW - (n - 1) * barGap) / n, 8);

  const yScale = v => mTop + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;
  const xGroupStart = gi => mLeft + gi * (groupW + groupGap);
  const xBar = (gi, bi) => xGroupStart(gi) + bi * (barW + barGap);
  const baseline = yScale(minVal);

  const yTicks = 4;
  const tickStep = (maxVal - minVal) / yTicks;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* Y 그리드 */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const v = minVal + i * tickStep;
        const y = yScale(v);
        return (
          <g key={i}>
            <line x1={mLeft} y1={y} x2={W - mRight} y2={y}
              stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
            <text x={mLeft - 4} y={y + 3.5} textAnchor="end"
              fontSize={8} fill="rgba(0,0,0,0.35)">{Math.round(v)}°</text>
          </g>
        );
      })}

      {/* X축 */}
      <line x1={mLeft} y1={baseline} x2={W - mRight} y2={baseline}
        stroke="rgba(0,0,0,0.12)" strokeWidth={1} />

      {/* 막대 + X 레이블 */}
      {metrics.map((metric, gi) => (
        <g key={metric.key}>
          {sources.map((src, bi) => {
            const val = Number(src.w[metric.key]) || 0;
            const x = xBar(gi, bi);
            const y = yScale(val);
            const bh = baseline - y;
            return (
              <g key={src.name}>
                <rect x={x} y={y} width={barW} height={Math.max(bh, 2)}
                  fill={src.color} rx={3} opacity={0.88} />
                <text x={x + barW / 2} y={y - 3} textAnchor="middle"
                  fontSize={7.5} fill={src.color} fontWeight="700">
                  {Number(val).toFixed(1)}°
                </text>
              </g>
            );
          })}
          <text x={xGroupStart(gi) + groupW / 2} y={H - mBottom + 15}
            textAnchor="middle" fontSize={10} fill="rgba(0,0,0,0.55)" fontWeight="600">
            {metric.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// WeatherRadarChart — 레이더/거미줄 차트 (습도·바람·강수확률 × 3소스)
// ══════════════════════════════════════════════════════════════════════════
export function WeatherRadarChart({ weather, compareWeather, meteoWeather, theme }) {
  const sources = [
    { name: "기상청",     color: "#2563eb", w: weather },
    { name: "OW",         color: "#ea580c", w: compareWeather },
    ...(meteoWeather ? [{ name: "Open-Meteo", color: "#059669", w: meteoWeather }] : []),
  ].filter(s => s.w);

  const allWind = sources.map(s => Number(s.w.wind) || 0);
  const maxWind = Math.max(...allWind, 1);

  const axes = [
    { key: "humidity",   label: "습도",    max: 100,           unit: "%",   fmt: v => Math.round(v) },
    { key: "wind",       label: "바람",    max: maxWind * 1.3, unit: "m/s", fmt: v => Number(v).toFixed(1) },
    { key: "rainChance", label: "강수확률", max: 100,           unit: "%",  fmt: v => Math.round(v) },
  ];

  const CX = 130, CY = 108, R = 72;
  const ang = i => ((270 + i * 120) * Math.PI) / 180;
  const pt = (i, val, max) => {
    const t = Math.min(val / (max || 1), 1);
    const a = ang(i);
    return [CX + R * t * Math.cos(a), CY + R * t * Math.sin(a)];
  };

  const levels = [0.25, 0.5, 0.75, 1];

  const poly = (w) =>
    axes.map((ax, i) => pt(i, Number(w[ax.key]) || 0, ax.max).join(",")).join(" ");

  // 축 끝 레이블 위치 (약간 바깥)
  const axLabel = i => {
    const a = ang(i);
    const dist = R + 22;
    return [CX + dist * Math.cos(a), CY + dist * Math.sin(a)];
  };

  return (
    <svg viewBox="0 0 260 210" style={{ width: "100%", height: "auto", display: "block" }}>
      {/* 그리드 레벨 */}
      {levels.map((lv, li) => (
        <polygon key={li}
          points={axes.map((_, i) => {
            const a = ang(i);
            return `${CX + R * lv * Math.cos(a)},${CY + R * lv * Math.sin(a)}`;
          }).join(" ")}
          fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={1} />
      ))}

      {/* 축 선 */}
      {axes.map((ax, i) => {
        const [ex, ey] = [CX + R * Math.cos(ang(i)), CY + R * Math.sin(ang(i))];
        const [lx, ly] = axLabel(i);
        return (
          <g key={ax.key}>
            <line x1={CX} y1={CY} x2={ex} y2={ey}
              stroke="rgba(0,0,0,0.1)" strokeWidth={1} />
            <text x={lx} y={ly + 4} textAnchor="middle"
              fontSize={10} fill="rgba(0,0,0,0.5)" fontWeight="600">
              {ax.label}
            </text>
          </g>
        );
      })}

      {/* 소스별 폴리곤 */}
      {[...sources].reverse().map(src => (
        <g key={src.name}>
          <polygon points={poly(src.w)}
            fill={`${src.color}28`} stroke={src.color}
            strokeWidth={2} strokeLinejoin="round" />
          {axes.map((ax, ai) => {
            const [px, py] = pt(ai, Number(src.w[ax.key]) || 0, ax.max);
            return (
              <circle key={ax.key} cx={px} cy={py} r={4}
                fill={src.color} stroke="white" strokeWidth={1.5} />
            );
          })}
        </g>
      ))}

      {/* 25% / 50% / 75% 눈금 텍스트 */}
      {[0.25, 0.5, 0.75].map(lv => {
        const [x, y] = [CX + R * lv * Math.cos(ang(0)), CY + R * lv * Math.sin(ang(0))];
        return (
          <text key={lv} x={x - 4} y={y} textAnchor="end"
            fontSize={7} fill="rgba(0,0,0,0.3)">{Math.round(lv * 100)}%</text>
        );
      })}

      {/* 수치 요약 — 각 축 꼭짓점 근처 */}
      {axes.map((ax, i) => {
        const a = ang(i);
        const dist = R + 38;
        const x = CX + dist * Math.cos(a);
        const y = CY + dist * Math.sin(a);
        return (
          <g key={ax.key}>
            {sources.map((src, si) => (
              <text key={src.name}
                x={x} y={y + 11 + si * 11}
                textAnchor="middle" fontSize={8.5}
                fill={src.color} fontWeight="700">
                {ax.fmt(Number(src.w[ax.key]) || 0)}{ax.unit}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
