import React, { useState } from "react";

// ── 공통: 범례 ─────────────────────────────────────────────────────────────
export function ChartLegend({ sources, theme, activeSrcs, onToggle }) {
  return (
    <div style={{ display: "flex", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
      {sources.map(s => {
        const isActive = !activeSrcs || activeSrcs.includes(s.name);
        return (
          <div key={s.name}
            onClick={() => onToggle?.(s.name)}
            style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer",
              opacity: isActive ? 1 : 0.35, transition: "opacity 0.15s" }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color,
              boxShadow: isActive ? `0 0 0 2px ${s.color}44` : "none" }} />
            <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 600,
              color: isActive ? s.color : theme.sub }}>{s.name}</span>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// HourlyCompareChart — 4개 소스 시간별 온도 라인 차트
// ══════════════════════════════════════════════════════════════════════════
export function HourlyCompareChart({ alignedHourly, hourSlots, weather, compareWeather, meteoWeather, wapiWeather, theme }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const [activeSrcs, setActiveSrcs] = useState(["기상청"]);

  const toggleSrc = name => setActiveSrcs(prev =>
    prev.includes(name)
      ? prev.length > 1 ? prev.filter(n => n !== name) : prev
      : [...prev, name]
  );

  const sourceDefs = [
    { name: "기상청",   color: "#2563eb", data: alignedHourly?.kma,   current: weather,       kma: true },
    { name: "ECMWF",    color: "#8B5CF6", data: alignedHourly?.ow,    current: compareWeather },
    { name: "오픈메테오",color: "#059669", data: alignedHourly?.meteo, current: meteoWeather },
    { name: "웨더API",  color: "#7c3aed", data: alignedHourly?.wapi,  current: wapiWeather  },
  ].filter(s => s.data?.some(d => d != null));

  if (!sourceDefs.length || !hourSlots?.length) return null;

  const slots = hourSlots.slice(0, 24);
  const nSlots = slots.length;

  const allTemps = sourceDefs.flatMap(s =>
    (s.data || []).slice(0, nSlots).map(d => d?.temp != null ? Number(d.temp) : null).filter(v => v != null)
  );
  if (!allTemps.length) return null;

  const rawMin = Math.min(...allTemps);
  const rawMax = Math.max(...allTemps);
  const pad = Math.max((rawMax - rawMin) * 0.25, 2);
  const minT = Math.floor(rawMin - pad);
  const maxT = Math.ceil(rawMax + pad);

  const W = 360, H = 176;
  const mTop = 18, mRight = 12, mBottom = 34, mLeft = 30;
  const cW = W - mLeft - mRight;
  const cH = H - mTop - mBottom;

  const xScale = i => mLeft + (nSlots > 1 ? (i / (nSlots - 1)) * cW : cW / 2);
  const yScale = v => mTop + cH - ((v - minT) / (maxT - minT || 1)) * cH;

  const yRange = maxT - minT;
  const tickStep = yRange <= 6 ? 2 : yRange <= 12 ? 3 : yRange <= 20 ? 4 : 5;
  const yTicks = [];
  for (let v = Math.ceil(minT / tickStep) * tickStep; v <= maxT; v += tickStep) yTicks.push(v);

  const activeIdx = hoverIdx ?? 0;
  const slotW = nSlots > 1 ? cW / (nSlots - 1) : cW;


  return (
    <div>
      <ChartLegend sources={sourceDefs} theme={theme} activeSrcs={activeSrcs} onToggle={toggleSrc} />

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Y 그리드 */}
        {yTicks.map(v => {
          const y = yScale(v);
          return (
            <g key={v}>
              <line x1={mLeft} y1={y} x2={W - mRight} y2={y}
                stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
              <text x={mLeft - 4} y={y + 3.5} textAnchor="end"
                fontSize={8} fill="rgba(0,0,0,0.35)">{v}°</text>
            </g>
          );
        })}

        {/* X축 */}
        <line x1={mLeft} y1={mTop + cH} x2={W - mRight} y2={mTop + cH}
          stroke="rgba(0,0,0,0.1)" strokeWidth={1} />

        {/* X 레이블 */}
        {slots.map((s, i) => {
          if (i !== 0 && i % 3 !== 0 && !s.isMidnight) return null;
          return (
            <text key={i} x={xScale(i)} y={H - mBottom + 11}
              textAnchor="middle" fontSize={8.5}
              fill={s.isMidnight ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.38)"}
              fontWeight={s.isMidnight ? "700" : "400"}>
              {s.label}
            </text>
          );
        })}

        {/* 소스별 라인 + 활성 점/레이블 */}
        {sourceDefs.map(src => {
          const isActive = activeSrcs.includes(src.name);
          const opacity = isActive ? 1 : 0.1;
          const pts = slots.map((_, i) => {
            const d = src.data?.[i];
            return d?.temp != null ? { x: xScale(i), y: yScale(Number(d.temp)), i } : null;
          });

          const segments = [];
          let seg = [];
          pts.forEach(p => {
            if (p) { seg.push(`${p.x},${p.y}`); }
            else if (seg.length) { segments.push(seg); seg = []; }
          });
          if (seg.length) segments.push(seg);

          const activePt = pts[activeIdx];

          return (
            <g key={src.name} style={{ transition: "opacity 0.15s" }} opacity={opacity}>
              {segments.map((s, si) => (
                <polyline key={si} points={s.join(" ")}
                  fill="none" stroke={src.color}
                  strokeWidth={src.kma ? 2.5 : 1.8}
                  strokeDasharray={src.kma ? "none" : "5,3"}
                  strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {activePt && isActive && (
                <g>
                  <circle cx={activePt.x} cy={activePt.y} r={4}
                    fill={src.color} stroke="white" strokeWidth={1.5} />
                  <text x={activePt.x} y={activePt.y - 7} textAnchor="middle"
                    fontSize={9} fill={src.color} fontWeight="700">
                    {Number(src.data?.[activeIdx]?.temp).toFixed(1)}°
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* hover 수직선 */}
        {hoverIdx != null && (
          <line x1={xScale(hoverIdx)} y1={mTop} x2={xScale(hoverIdx)} y2={mTop + cH}
            stroke="rgba(0,0,0,0.18)" strokeWidth={1} strokeDasharray="3,2" />
        )}

        {/* hover 시각 레이블 */}
        {hoverIdx != null && slots[hoverIdx] && (
          <text x={xScale(hoverIdx)} y={mTop - 5} textAnchor="middle"
            fontSize={8.5} fill="rgba(0,0,0,0.5)">
            {slots[hoverIdx].label}
          </text>
        )}

        {/* 투명 hover 존 */}
        {slots.map((_, i) => (
          <rect key={i}
            x={xScale(i) - slotW / 2} y={mTop}
            width={slotW} height={cH}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
          />
        ))}
      </svg>

      {/* 현재 시각 기준 소스별 미니 카드 */}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {sourceDefs.map(src => {
          const d = src.data?.[0];
          const isActive = activeSrcs.includes(src.name);
          return (
            <div key={src.name}
              style={{
                flex: "1 1 0", minWidth: 60,
                padding: "8px 10px", borderRadius: 14,
                background: `${src.color}12`,
                borderLeft: `3px solid ${src.color}`,
                opacity: isActive ? 1 : 0.1,
                transition: "opacity 0.15s",
                cursor: "pointer",
              }}
              onClick={() => toggleSrc(src.name)}
            >
              <p style={{ fontSize: 10, fontWeight: 700, color: src.color, marginBottom: 2 }}>{src.name}</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: theme.text, lineHeight: 1.2 }}>
                {d?.temp != null ? `${Number(d.temp).toFixed(1)}°` : "—"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// HourlyRainChart — 4개 소스 시간별 강수확률 꺾은선 차트
// ══════════════════════════════════════════════════════════════════════════
export function HourlyRainChart({ alignedHourly, hourSlots, theme }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const [activeSrcs, setActiveSrcs] = useState(["기상청"]);

  const toggleSrc = name => setActiveSrcs(prev =>
    prev.includes(name)
      ? prev.length > 1 ? prev.filter(n => n !== name) : prev
      : [...prev, name]
  );

  const sourceDefs = [
    { name: "기상청",    color: "#2563eb", data: alignedHourly?.kma },
    { name: "ECMWF",     color: "#8B5CF6", data: alignedHourly?.ow },
    { name: "오픈메테오",color: "#059669", data: alignedHourly?.meteo },
    { name: "웨더API",   color: "#7c3aed", data: alignedHourly?.wapi },
  ].filter(s => s.data?.some(d => d != null && d.rainChance != null));

  if (!sourceDefs.length || !hourSlots?.length) return null;

  const slots = hourSlots.slice(0, 24);
  const nSlots = slots.length;
  const nSrc = sourceDefs.length;

  const W = 360, H = 160;
  const mTop = 14, mRight = 12, mBottom = 34, mLeft = 30;
  const cW = W - mLeft - mRight;
  const cH = H - mTop - mBottom;

  const groupW = cW / nSlots;
  const barPad = 1.5;
  const barGap = 0.6;
  const barAreaW = groupW - barPad * 2;
  const barW = Math.max((barAreaW - barGap * (nSrc - 1)) / nSrc, 1.5);

  const yScale = v => mTop + cH - (Math.min(v, 100) / 100) * cH;
  const yTicks = [0, 25, 50, 75, 100];

  const groupX = i => mLeft + i * groupW;
  const barX = (i, bi) => groupX(i) + barPad + bi * (barW + barGap);


  return (
    <div>
      <ChartLegend sources={sourceDefs} theme={theme} activeSrcs={activeSrcs} onToggle={toggleSrc} />

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Y 그리드 */}
        {yTicks.map(v => {
          const y = yScale(v);
          return (
            <g key={v}>
              <line x1={mLeft} y1={y} x2={W - mRight} y2={y}
                stroke={v === 0 ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.05)"}
                strokeWidth={1} strokeDasharray={v === 0 ? "none" : "3,3"} />
              <text x={mLeft - 4} y={y + 3.5} textAnchor="end"
                fontSize={8} fill="rgba(0,0,0,0.35)">{v}%</text>
            </g>
          );
        })}

        {/* X축 */}
        <line x1={mLeft} y1={mTop + cH} x2={W - mRight} y2={mTop + cH}
          stroke="rgba(0,0,0,0.1)" strokeWidth={1} />

        {/* X 레이블 */}
        {slots.map((s, i) => {
          if (i !== 0 && i % 3 !== 0 && !s.isMidnight) return null;
          return (
            <text key={i} x={groupX(i) + groupW / 2} y={H - mBottom + 11}
              textAnchor="middle" fontSize={8.5}
              fill={s.isMidnight ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.38)"}
              fontWeight={s.isMidnight ? "700" : "400"}>
              {s.label}
            </text>
          );
        })}

        {/* hover 배경 */}
        {hoverIdx != null && (
          <rect x={groupX(hoverIdx)} y={mTop} width={groupW} height={cH}
            fill="rgba(0,0,0,0.05)" rx={2} />
        )}

        {/* 소스별 막대 */}
        {slots.map((_, i) => (
          <g key={i}>
            {sourceDefs.map((src, bi) => {
              const d = src.data?.[i];
              const val = d?.rainChance != null ? Number(d.rainChance) : 0;
              if (val === 0) return null;
              const x = barX(i, bi);
              const y = yScale(val);
              const bh = mTop + cH - y;
              const isHover = hoverIdx === i;
              const isActive = activeSrcs.includes(src.name);
              return (
                <g key={src.name} style={{ transition: "opacity 0.15s" }} opacity={isActive ? 1 : 0.1}>
                  <rect x={x} y={y} width={barW} height={Math.max(bh, 1)}
                    fill={src.color} rx={1}
                    opacity={isHover ? 1 : 0.82} />
                  {isHover && isActive && val > 0 && (
                    <text x={x + barW / 2} y={y - 3} textAnchor="middle"
                      fontSize={7.5} fill={src.color} fontWeight="700">
                      {val}%
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        ))}

        {/* hover 시각 레이블 */}
        {hoverIdx != null && slots[hoverIdx] && (
          <text x={groupX(hoverIdx) + groupW / 2} y={mTop - 3} textAnchor="middle"
            fontSize={8.5} fill="rgba(0,0,0,0.5)">
            {slots[hoverIdx].label}
          </text>
        )}

        {/* 투명 hover 존 */}
        {slots.map((_, i) => (
          <rect key={i}
            x={groupX(i)} y={mTop} width={groupW} height={cH}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
          />
        ))}
      </svg>

      {/* 현재 시각 기준 소스별 미니 카드 */}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {sourceDefs.map(src => {
          const d = src.data?.[0];
          const isActive = activeSrcs.includes(src.name);
          return (
            <div key={src.name}
              style={{
                flex: "1 1 0", minWidth: 60,
                padding: "8px 10px", borderRadius: 14,
                background: `${src.color}12`,
                borderLeft: `3px solid ${src.color}`,
                opacity: isActive ? 1 : 0.1,
                transition: "opacity 0.15s",
                cursor: "pointer",
              }}
              onClick={() => toggleSrc(src.name)}
            >
              <p style={{ fontSize: 10, fontWeight: 700, color: src.color, marginBottom: 2 }}>{src.name}</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: theme.text, lineHeight: 1.2 }}>
                {d?.rainChance != null ? `${d.rainChance}%` : "—"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TemperatureBarChart — 세로 막대 그래프 (기온/체감/최고/최저 × 3소스)
// ══════════════════════════════════════════════════════════════════════════
export function TemperatureBarChart({ weather, compareWeather, meteoWeather, wapiWeather, theme }) {
  const sources = [
    { name: "기상청",    color: "#2563eb", w: weather },
    { name: "ECMWF",     color: "#8B5CF6", w: compareWeather },
    ...(meteoWeather ? [{ name: "오픈메테오", color: "#059669", w: meteoWeather }] : []),
    ...(wapiWeather  ? [{ name: "웨더API",   color: "#7c3aed", w: wapiWeather  }] : []),
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
export function WeatherRadarChart({ weather, compareWeather, meteoWeather, wapiWeather, theme }) {
  const sources = [
    { name: "기상청",     color: "#2563eb", w: weather },
    { name: "ECMWF",     color: "#8B5CF6", w: compareWeather },
    ...(meteoWeather ? [{ name: "오픈메테오", color: "#059669", w: meteoWeather }] : []),
    ...(wapiWeather  ? [{ name: "웨더API",   color: "#7c3aed", w: wapiWeather  }] : []),
  ].filter(s => s.w);

  const allWind = sources.map(s => Number(s.w.wind) || 0);
  const maxWind = Math.max(...allWind, 1);

  const axes = [
    { key: "humidity",   label: "습도",    max: 100,           unit: "%",   fmt: v => Math.round(v) },
    { key: "wind",       label: "바람",    max: maxWind * 1.3, unit: "m/s", fmt: v => Number(v).toFixed(1) },
    { key: "rainChance", label: "강수확률", max: 100,           unit: "%",   fmt: v => Math.round(v) },
  ];

  const CX = 130, CY = 100, R = 68;
  const ang = i => ((270 + i * 120) * Math.PI) / 180;
  const pt = (i, val, max) => {
    const t = Math.min(val / (max || 1), 1);
    const a = ang(i);
    return [CX + R * t * Math.cos(a), CY + R * t * Math.sin(a)];
  };

  const levels = [0.25, 0.5, 0.75, 1];

  const poly = (w) =>
    axes.map((ax, i) => pt(i, Number(w[ax.key]) || 0, ax.max).join(",")).join(" ");

  const axLabel = i => {
    const a = ang(i);
    const dist = R + 22;
    return [CX + dist * Math.cos(a), CY + dist * Math.sin(a)];
  };

  return (
    <div>
      <svg viewBox="0 0 260 200" style={{ width: "100%", height: "auto", display: "block" }}>
        {/* 그리드 레벨 */}
        {levels.map((lv, li) => (
          <polygon key={li}
            points={axes.map((_, i) => {
              const a = ang(i);
              return `${CX + R * lv * Math.cos(a)},${CY + R * lv * Math.sin(a)}`;
            }).join(" ")}
            fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={1} />
        ))}

        {/* 축 선 + 레이블 */}
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

        {/* 25% / 50% / 75% 눈금 */}
        {[0.25, 0.5, 0.75].map(lv => {
          const [x, y] = [CX + R * lv * Math.cos(ang(0)), CY + R * lv * Math.sin(ang(0))];
          return (
            <text key={lv} x={x - 4} y={y} textAnchor="end"
              fontSize={7} fill="rgba(0,0,0,0.3)">{Math.round(lv * 100)}%</text>
          );
        })}
      </svg>

      {/* 수치 요약 — 축별 컬럼 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${axes.length}, 1fr)`,
        gap: 4,
        marginTop: 2,
        marginBottom: 10,
        paddingBottom: 2,
      }}>
        {axes.map(ax => (
          <div key={ax.key} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "rgba(0,0,0,0.4)", fontWeight: 700, marginBottom: 3, letterSpacing: "0.03em" }}>
              {ax.label}
            </div>
            {sources.map(src => (
              <div key={src.name} style={{ fontSize: 10, fontWeight: 700, color: src.color, lineHeight: 1.6 }}>
                {ax.fmt(Number(src.w[ax.key]) || 0)}{ax.unit}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 공통: 날짜 짧게 변환 → ["15일", "(일)"]
// "일" 문자 탐색 대신 숫자로 추출 (일요일 "(일)"과 충돌 방지)
function splitDateLabel(str) {
  if (!str) return ["", ""];
  const nums = str.match(/\d+/g) || [];
  // 마지막 숫자가 일(day) — 형식: "6월 15일 (목)" or "6. 15. (목)"
  const dayNum = nums[nums.length - 1];
  const dow = str.match(/\(([가-힣]+)\)/)?.[1] || "";
  return [dayNum ? `${dayNum}일` : "", dow ? `(${dow})` : ""];
}

// ══════════════════════════════════════════════════════════════════════════
// ── 공통 소스 정의 헬퍼 ──────────────────────────────────────────────────
function buildDailySources(dailyForecasts, owDailyForecasts, meteoDaily, wapiDailyForecasts) {
  return [
    { name: "기상청",    color: "#2563eb", days: dailyForecasts?.length    ? dailyForecasts.slice(0, 5).map(d => ({ date: d.date, min: d.min, max: d.max, rainChance: d.rainChance })) : null },
    { name: "ECMWF",     color: "#8B5CF6", days: owDailyForecasts?.length   ? owDailyForecasts.slice(0, 5).map(d => ({ date: d.date, min: d.min, max: d.max, rainChance: d.rainChance })) : null },
    { name: "오픈메테오",color: "#059669", days: meteoDaily?.length         ? meteoDaily.slice(1, 6).map(d => ({ date: d.dateLabel, min: d.tempMin, max: d.tempMax, rainChance: d.rainChance })) : null },
    { name: "웨더API",   color: "#7c3aed", days: wapiDailyForecasts?.length ? wapiDailyForecasts.slice(0, 5).map(d => ({ date: d.date, min: d.min, max: d.max, rainChance: d.rainChance })) : null },
  ].filter(s => s.days?.length);
}

// DailyTempChart — 5일 최고/최저 온도 꺾은선
// ══════════════════════════════════════════════════════════════════════════
export function DailyTempChart({ dailyForecasts, owDailyForecasts, meteoDaily, wapiDailyForecasts, theme }) {
  const [activeSrcs, setActiveSrcs] = useState(["기상청"]);
  const [hoverIdx, setHoverIdx] = useState(null);
  const toggleSrc = name => setActiveSrcs(prev =>
    prev.includes(name) ? (prev.length > 1 ? prev.filter(n => n !== name) : prev) : [...prev, name]
  );

  const sourceDefs = buildDailySources(dailyForecasts, owDailyForecasts, meteoDaily, wapiDailyForecasts);
  if (!sourceDefs.length) return null;

  const nDays = Math.max(...sourceDefs.map(s => s.days.length));
  const refLabels = sourceDefs[0].days.map(d => d.date);

  const W = 360, mLeft = 32, mRight = 12, mTop = 18, mBottom = 40;
  const cW = W - mLeft - mRight, cH = 130, H = mTop + cH + mBottom;
  const groupW = cW / nDays;
  const groupCx = i => mLeft + i * groupW + groupW / 2;
  const groupX  = i => mLeft + i * groupW;

  const allTemps = sourceDefs.flatMap(s => s.days.flatMap(d => [d.min, d.max].filter(v => v != null).map(Number)));
  const rawMin = Math.min(...allTemps), rawMax = Math.max(...allTemps);
  const tPad = Math.max((rawMax - rawMin) * 0.2, 2);
  const minT = Math.floor(rawMin - tPad), maxT = Math.ceil(rawMax + tPad);
  const yT = v => mTop + cH - ((v - minT) / (maxT - minT || 1)) * cH;
  const tRange = maxT - minT;
  const tStep = tRange <= 6 ? 2 : tRange <= 12 ? 3 : tRange <= 20 ? 4 : 5;
  const tTicks = [];
  for (let v = Math.ceil(minT / tStep) * tStep; v <= maxT; v += tStep) tTicks.push(v);

  return (
    <div>
      <ChartLegend sources={sourceDefs} theme={theme} activeSrcs={activeSrcs} onToggle={toggleSrc} />
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}
        onMouseLeave={() => setHoverIdx(null)}>

        {tTicks.map(v => {
          const y = yT(v);
          return (
            <g key={v}>
              <line x1={mLeft} y1={y} x2={W - mRight} y2={y} stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
              <text x={mLeft - 4} y={y + 3.5} textAnchor="end" fontSize={7.5} fill="rgba(0,0,0,0.38)">{v}°</text>
            </g>
          );
        })}

        <line x1={mLeft} y1={mTop + cH} x2={W - mRight} y2={mTop + cH} stroke="rgba(0,0,0,0.1)" strokeWidth={1} />

        {Array.from({ length: nDays }, (_, i) => {
          const [day, dow] = splitDateLabel(refLabels[i]);
          const cx = groupCx(i);
          return (
            <g key={i}>
              <text x={cx} y={H - mBottom + 13} textAnchor="middle" fontSize={8.5} fill="rgba(0,0,0,0.5)">{day}</text>
              <text x={cx} y={H - mBottom + 24} textAnchor="middle" fontSize={8} fill="rgba(0,0,0,0.35)">{dow}</text>
            </g>
          );
        })}

        {sourceDefs.map(src => {
          const isActive = activeSrcs.includes(src.name);
          const maxPts = src.days.map((d, i) => d.max != null ? { x: groupCx(i), y: yT(Number(d.max)), val: Number(d.max) } : null);
          const minPts = src.days.map((d, i) => d.min != null ? { x: groupCx(i), y: yT(Number(d.min)), val: Number(d.min) } : null);
          const vMax = maxPts.filter(Boolean), vMin = minPts.filter(Boolean);
          return (
            <g key={src.name} opacity={isActive ? 1 : 0.08} style={{ transition: "opacity 0.15s" }}>
              {vMax.length > 1 && <polyline points={vMax.map(p => `${p.x},${p.y}`).join(" ")}
                fill="none" stroke={src.color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />}
              {vMin.length > 1 && <polyline points={vMin.map(p => `${p.x},${p.y}`).join(" ")}
                fill="none" stroke={src.color} strokeWidth={1.5} strokeDasharray="4,2.5"
                strokeLinejoin="round" strokeLinecap="round" />}
              {hoverIdx != null && isActive && (() => {
                const mx = maxPts[hoverIdx], mn = minPts[hoverIdx];
                return (
                  <g>
                    {mx && <><circle cx={mx.x} cy={mx.y} r={4} fill={src.color} stroke="white" strokeWidth={1.5} />
                      <text x={mx.x} y={mx.y - 7} textAnchor="middle" fontSize={9} fill={src.color} fontWeight="700">{mx.val.toFixed(1)}°</text></>}
                    {mn && <><circle cx={mn.x} cy={mn.y} r={3.5} fill={src.color} stroke="white" strokeWidth={1.5} />
                      <text x={mn.x} y={mn.y + 15} textAnchor="middle" fontSize={9} fill={src.color} fontWeight="700">{mn.val.toFixed(1)}°</text></>}
                  </g>
                );
              })()}
            </g>
          );
        })}

        {hoverIdx != null && (
          <line x1={groupCx(hoverIdx)} y1={mTop} x2={groupCx(hoverIdx)} y2={mTop + cH}
            stroke="rgba(0,0,0,0.15)" strokeWidth={1} strokeDasharray="3,2" />
        )}
        {Array.from({ length: nDays }, (_, i) => (
          <rect key={i} x={groupX(i)} y={mTop} width={groupW} height={cH}
            fill="transparent" onMouseEnter={() => setHoverIdx(i)} />
        ))}
      </svg>

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {sourceDefs.map(src => {
          const d = src.days[0];
          const isActive = activeSrcs.includes(src.name);
          return (
            <div key={src.name} onClick={() => toggleSrc(src.name)} style={{
              flex: "1 1 0", minWidth: 60, padding: "8px 10px", borderRadius: 14,
              background: `${src.color}12`, borderLeft: `3px solid ${src.color}`,
              opacity: isActive ? 1 : 0.2, transition: "opacity 0.15s", cursor: "pointer",
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: src.color, marginBottom: 2 }}>{src.name}</p>
              <p style={{ fontSize: 14, fontWeight: 800, color: theme.text, lineHeight: 1.3 }}>
                {d?.max != null ? `${Number(d.max).toFixed(0)}°` : "—"}
                <span style={{ fontSize: 10, fontWeight: 500, color: theme.sub, marginLeft: 3 }}>
                  {d?.min != null ? `/ ${Number(d.min).toFixed(0)}°` : ""}
                </span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// DailyRainChart — 5일 강수확률 막대
// ══════════════════════════════════════════════════════════════════════════
export function DailyRainChart({ dailyForecasts, owDailyForecasts, meteoDaily, wapiDailyForecasts, theme }) {
  const [activeSrcs, setActiveSrcs] = useState(["기상청"]);
  const [hoverIdx, setHoverIdx] = useState(null);
  const toggleSrc = name => setActiveSrcs(prev =>
    prev.includes(name) ? (prev.length > 1 ? prev.filter(n => n !== name) : prev) : [...prev, name]
  );

  const sourceDefs = buildDailySources(dailyForecasts, owDailyForecasts, meteoDaily, wapiDailyForecasts);
  if (!sourceDefs.length) return null;

  const nDays = Math.max(...sourceDefs.map(s => s.days.length));
  const nSrc = sourceDefs.length;
  const refLabels = sourceDefs[0].days.map(d => d.date);

  const W = 360, mLeft = 28, mRight = 12, mTop = 12, mBottom = 40;
  const cW = W - mLeft - mRight, cH = 110, H = mTop + cH + mBottom;
  const groupW = cW / nDays;
  const groupX  = i => mLeft + i * groupW;
  const groupCx = i => groupX(i) + groupW / 2;
  const yR = v => mTop + cH - (Math.min(v, 100) / 100) * cH;

  const barPad = 3, barGap = 1;
  const barW = Math.max((groupW - barPad * 2 - barGap * (nSrc - 1)) / nSrc, 2);
  const barX = (i, bi) => groupX(i) + barPad + bi * (barW + barGap);

  return (
    <div>
      <ChartLegend sources={sourceDefs} theme={theme} activeSrcs={activeSrcs} onToggle={toggleSrc} />
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}
        onMouseLeave={() => setHoverIdx(null)}>

        {[0, 25, 50, 75, 100].map(v => {
          const y = yR(v);
          return (
            <g key={v}>
              <line x1={mLeft} y1={y} x2={W - mRight} y2={y} stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
              <text x={mLeft - 4} y={y + 3.5} textAnchor="end" fontSize={7.5} fill="rgba(0,100,200,0.45)">{v}%</text>
            </g>
          );
        })}

        <line x1={mLeft} y1={mTop + cH} x2={W - mRight} y2={mTop + cH} stroke="rgba(0,0,0,0.1)" strokeWidth={1} />

        {Array.from({ length: nDays }, (_, i) => {
          const [day, dow] = splitDateLabel(refLabels[i]);
          const cx = groupCx(i);
          return (
            <g key={i}>
              <text x={cx} y={H - mBottom + 13} textAnchor="middle" fontSize={8.5} fill="rgba(0,0,0,0.5)">{day}</text>
              <text x={cx} y={H - mBottom + 24} textAnchor="middle" fontSize={8} fill="rgba(0,0,0,0.35)">{dow}</text>
            </g>
          );
        })}

        {Array.from({ length: nDays }, (_, i) => (
          <g key={i}>
            {sourceDefs.map((src, bi) => {
              const val = src.days[i]?.rainChance != null ? Number(src.days[i].rainChance) : 0;
              const x = barX(i, bi), y = yR(val), bh = mTop + cH - y;
              const isActive = activeSrcs.includes(src.name);
              return (
                <g key={src.name} opacity={isActive ? 1 : 0.08} style={{ transition: "opacity 0.15s" }}>
                  <rect x={x} y={val > 0 ? y : mTop + cH - 1} width={barW}
                    height={val > 0 ? Math.max(bh, 2) : 1}
                    fill={src.color} rx={1} opacity={hoverIdx === i ? 0.75 : 0.5} />
                  {hoverIdx === i && isActive && val > 0 && (
                    <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={7.5} fill={src.color} fontWeight="700">{val}%</text>
                  )}
                </g>
              );
            })}
          </g>
        ))}

        {hoverIdx != null && (
          <line x1={groupCx(hoverIdx)} y1={mTop} x2={groupCx(hoverIdx)} y2={mTop + cH}
            stroke="rgba(0,0,0,0.15)" strokeWidth={1} strokeDasharray="3,2" />
        )}
        {Array.from({ length: nDays }, (_, i) => (
          <rect key={i} x={groupX(i)} y={mTop} width={groupW} height={cH}
            fill="transparent" onMouseEnter={() => setHoverIdx(i)} />
        ))}
      </svg>

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {sourceDefs.map(src => {
          const d = src.days[0];
          const isActive = activeSrcs.includes(src.name);
          return (
            <div key={src.name} onClick={() => toggleSrc(src.name)} style={{
              flex: "1 1 0", minWidth: 60, padding: "8px 10px", borderRadius: 14,
              background: `${src.color}12`, borderLeft: `3px solid ${src.color}`,
              opacity: isActive ? 1 : 0.2, transition: "opacity 0.15s", cursor: "pointer",
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: src.color, marginBottom: 2 }}>{src.name}</p>
              <p style={{ fontSize: 14, fontWeight: 800, color: theme.text, lineHeight: 1.3 }}>
                {d?.rainChance != null ? `${Number(d.rainChance).toFixed(0)}%` : "—"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// DailyForecastChart — 하위 호환 alias
export function DailyForecastChart(props) { return <DailyTempChart {...props} />; }


// ══════════════════════════════════════════════════════════════════════════
// _DailyRainChart_unused — deprecated
// ══════════════════════════════════════════════════════════════════════════
function _DailyRainChart_unused({ dailyForecasts, owDailyForecasts, meteoDaily, wapiDailyForecasts, theme }) {
  const [activeSrcs, setActiveSrcs] = useState(["기상청"]);
  const [hoverIdx, setHoverIdx] = useState(null);

  const toggleSrc = name => setActiveSrcs(prev =>
    prev.includes(name)
      ? prev.length > 1 ? prev.filter(n => n !== name) : prev
      : [...prev, name]
  );

  const sourceDefs = [
    { name: "기상청",    color: "#2563eb", days: dailyForecasts?.length    ? dailyForecasts.slice(0, 5).map(d => ({ date: d.date, min: d.min, max: d.max })) : null },
    { name: "ECMWF",     color: "#8B5CF6", days: owDailyForecasts?.length   ? owDailyForecasts.slice(0, 5).map(d => ({ date: d.date, min: d.min, max: d.max })) : null },
    { name: "오픈메테오",color: "#059669", days: meteoDaily?.length         ? meteoDaily.slice(1, 6).map(d => ({ date: d.dateLabel, min: d.tempMin, max: d.tempMax })) : null },
    { name: "웨더API",   color: "#7c3aed", days: wapiDailyForecasts?.length ? wapiDailyForecasts.slice(0, 5).map(d => ({ date: d.date, min: d.min, max: d.max })) : null },
  ].filter(s => s.days?.length);

  if (!sourceDefs.length) return null;

  const nDays = Math.max(...sourceDefs.map(s => s.days.length));
  const refLabels = sourceDefs[0].days.map(d => d.date);

  const allTemps = sourceDefs.flatMap(s => s.days.flatMap(d => [d.min, d.max].filter(v => v != null).map(Number)));
  if (!allTemps.length) return null;

  const rawMin = Math.min(...allTemps);
  const rawMax = Math.max(...allTemps);
  const pad = Math.max((rawMax - rawMin) * 0.25, 2);
  const minT = Math.floor(rawMin - pad);
  const maxT = Math.ceil(rawMax + pad);

  const W = 360, H = 190;
  const mTop = 18, mRight = 12, mBottom = 44, mLeft = 30;
  const cW = W - mLeft - mRight;
  const cH = H - mTop - mBottom;

  const xScale = i => mLeft + (nDays > 1 ? (i / (nDays - 1)) * cW : cW / 2);
  const yScale = v => mTop + cH - ((v - minT) / (maxT - minT || 1)) * cH;

  const yRange = maxT - minT;
  const tickStep = yRange <= 6 ? 2 : yRange <= 12 ? 3 : yRange <= 20 ? 4 : 5;
  const yTicks = [];
  for (let v = Math.ceil(minT / tickStep) * tickStep; v <= maxT; v += tickStep) yTicks.push(v);

  const slotW = nDays > 1 ? cW / (nDays - 1) : cW;

  return (
    <div>
      <ChartLegend sources={sourceDefs} theme={theme} activeSrcs={activeSrcs} onToggle={toggleSrc} />
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}
        onMouseLeave={() => setHoverIdx(null)}>

        {yTicks.map(v => {
          const y = yScale(v);
          return (
            <g key={v}>
              <line x1={mLeft} y1={y} x2={W - mRight} y2={y} stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
              <text x={mLeft - 4} y={y + 3.5} textAnchor="end" fontSize={8} fill="rgba(0,0,0,0.35)">{v}°</text>
            </g>
          );
        })}

        <line x1={mLeft} y1={mTop + cH} x2={W - mRight} y2={mTop + cH} stroke="rgba(0,0,0,0.1)" strokeWidth={1} />

        {Array.from({ length: nDays }, (_, i) => {
          const [day, dow] = splitDateLabel(refLabels[i]);
          return (
            <g key={i}>
              <text x={xScale(i)} y={H - mBottom + 13} textAnchor="middle" fontSize={8.5} fill="rgba(0,0,0,0.5)">{day}</text>
              <text x={xScale(i)} y={H - mBottom + 24} textAnchor="middle" fontSize={8} fill="rgba(0,0,0,0.35)">{dow}</text>
            </g>
          );
        })}

        {sourceDefs.map(src => {
          const isActive = activeSrcs.includes(src.name);
          const maxPts = src.days.map((d, i) => d.max != null ? { x: xScale(i), y: yScale(Number(d.max)), val: Number(d.max) } : null);
          const minPts = src.days.map((d, i) => d.min != null ? { x: xScale(i), y: yScale(Number(d.min)), val: Number(d.min) } : null);
          const validMax = maxPts.filter(Boolean);
          const validMin = minPts.filter(Boolean);
          const bandPts = [...validMax, ...[...validMin].reverse()].map(p => `${p.x},${p.y}`).join(" ");

          return (
            <g key={src.name} opacity={isActive ? 1 : 0.1} style={{ transition: "opacity 0.15s" }}>
              {validMax.length > 1 && <polygon points={bandPts} fill={`${src.color}18`} />}
              {validMax.length > 1 && (
                <polyline points={validMax.map(p => `${p.x},${p.y}`).join(" ")}
                  fill="none" stroke={src.color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
              )}
              {validMin.length > 1 && (
                <polyline points={validMin.map(p => `${p.x},${p.y}`).join(" ")}
                  fill="none" stroke={src.color} strokeWidth={1.5} strokeDasharray="4,2.5"
                  strokeLinejoin="round" strokeLinecap="round" />
              )}
              {hoverIdx != null && isActive && (() => {
                const mx = maxPts[hoverIdx];
                const mn = minPts[hoverIdx];
                return (
                  <g>
                    {mx && <>
                      <circle cx={mx.x} cy={mx.y} r={4} fill={src.color} stroke="white" strokeWidth={1.5} />
                      <text x={mx.x} y={mx.y - 7} textAnchor="middle" fontSize={9} fill={src.color} fontWeight="700">{mx.val.toFixed(1)}°</text>
                    </>}
                    {mn && <>
                      <circle cx={mn.x} cy={mn.y} r={3.5} fill={src.color} stroke="white" strokeWidth={1.5} />
                      <text x={mn.x} y={mn.y + 15} textAnchor="middle" fontSize={9} fill={src.color} fontWeight="700">{mn.val.toFixed(1)}°</text>
                    </>}
                  </g>
                );
              })()}
            </g>
          );
        })}

        {hoverIdx != null && (
          <line x1={xScale(hoverIdx)} y1={mTop} x2={xScale(hoverIdx)} y2={mTop + cH}
            stroke="rgba(0,0,0,0.18)" strokeWidth={1} strokeDasharray="3,2" />
        )}

        {Array.from({ length: nDays }, (_, i) => (
          <rect key={i} x={xScale(i) - slotW / 2} y={mTop} width={slotW} height={cH}
            fill="transparent" onMouseEnter={() => setHoverIdx(i)} />
        ))}
      </svg>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// _DailyRainChart_old — deprecated alias, replaced by new DailyRainChart above
// ══════════════════════════════════════════════════════════════════════════
function _DailyRainChart_old({ dailyForecasts, owDailyForecasts, meteoDaily, wapiDailyForecasts, theme }) {
  const [activeSrcs, setActiveSrcs] = useState(["기상청"]);
  const [hoverIdx, setHoverIdx] = useState(null);

  const toggleSrc = name => setActiveSrcs(prev =>
    prev.includes(name)
      ? prev.length > 1 ? prev.filter(n => n !== name) : prev
      : [...prev, name]
  );

  const sourceDefs = [
    { name: "기상청",    color: "#2563eb", days: dailyForecasts?.length    ? dailyForecasts.slice(0, 5).map(d => ({ date: d.date, rainChance: d.rainChance })) : null },
    { name: "ECMWF",     color: "#8B5CF6", days: owDailyForecasts?.length   ? owDailyForecasts.slice(0, 5).map(d => ({ date: d.date, rainChance: d.rainChance })) : null },
    { name: "오픈메테오",color: "#059669", days: meteoDaily?.length         ? meteoDaily.slice(1, 6).map(d => ({ date: d.dateLabel, rainChance: d.rainChance })) : null },
    { name: "웨더API",   color: "#7c3aed", days: wapiDailyForecasts?.length ? wapiDailyForecasts.slice(0, 5).map(d => ({ date: d.date, rainChance: d.rainChance })) : null },
  ].filter(s => s.days?.length);

  if (!sourceDefs.length) return null;

  const nDays = Math.max(...sourceDefs.map(s => s.days.length));
  const refLabels = sourceDefs[0].days.map(d => d.date);
  const nSrc = sourceDefs.length;

  const W = 360, H = 160;
  const mTop = 14, mRight = 12, mBottom = 44, mLeft = 30;
  const cW = W - mLeft - mRight;
  const cH = H - mTop - mBottom;

  const groupW = cW / nDays;
  const barPad = 3;
  const barGap = 1;
  const barAreaW = groupW - barPad * 2;
  const barW = Math.max((barAreaW - barGap * (nSrc - 1)) / nSrc, 2);

  const yScale = v => mTop + cH - (Math.min(v, 100) / 100) * cH;
  const yTicks = [0, 25, 50, 75, 100];
  const groupX = i => mLeft + i * groupW;
  const barX = (i, bi) => groupX(i) + barPad + bi * (barW + barGap);

  return (
    <div>
      <ChartLegend sources={sourceDefs} theme={theme} activeSrcs={activeSrcs} onToggle={toggleSrc} />
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}
        onMouseLeave={() => setHoverIdx(null)}>

        {yTicks.map(v => {
          const y = yScale(v);
          return (
            <g key={v}>
              <line x1={mLeft} y1={y} x2={W - mRight} y2={y}
                stroke={v === 0 ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.05)"}
                strokeWidth={1} strokeDasharray={v === 0 ? "none" : "3,3"} />
              <text x={mLeft - 4} y={y + 3.5} textAnchor="end" fontSize={8} fill="rgba(0,0,0,0.35)">{v}%</text>
            </g>
          );
        })}

        <line x1={mLeft} y1={mTop + cH} x2={W - mRight} y2={mTop + cH} stroke="rgba(0,0,0,0.1)" strokeWidth={1} />

        {Array.from({ length: nDays }, (_, i) => {
          const [day, dow] = splitDateLabel(refLabels[i]);
          return (
            <g key={i}>
              <text x={groupX(i) + groupW / 2} y={H - mBottom + 13} textAnchor="middle" fontSize={8.5} fill="rgba(0,0,0,0.5)">{day}</text>
              <text x={groupX(i) + groupW / 2} y={H - mBottom + 24} textAnchor="middle" fontSize={8} fill="rgba(0,0,0,0.35)">{dow}</text>
            </g>
          );
        })}

        {hoverIdx != null && (
          <rect x={groupX(hoverIdx)} y={mTop} width={groupW} height={cH} fill="rgba(0,0,0,0.05)" rx={2} />
        )}

        {Array.from({ length: nDays }, (_, i) => (
          <g key={i}>
            {sourceDefs.map((src, bi) => {
              const val = src.days[i]?.rainChance != null ? Number(src.days[i].rainChance) : 0;
              if (val === 0) return null;
              const x = barX(i, bi);
              const y = yScale(val);
              const bh = mTop + cH - y;
              const isActive = activeSrcs.includes(src.name);
              return (
                <g key={src.name} opacity={isActive ? 1 : 0.1} style={{ transition: "opacity 0.15s" }}>
                  <rect x={x} y={y} width={barW} height={Math.max(bh, 1)} fill={src.color} rx={1}
                    opacity={hoverIdx === i ? 1 : 0.82} />
                  {hoverIdx === i && isActive && (
                    <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={7.5} fill={src.color} fontWeight="700">{val}%</text>
                  )}
                </g>
              );
            })}
          </g>
        ))}

        {hoverIdx != null && refLabels[hoverIdx] && (
          <text x={groupX(hoverIdx) + groupW / 2} y={mTop - 3} textAnchor="middle" fontSize={8.5} fill="rgba(0,0,0,0.5)">
            {splitDateLabel(refLabels[hoverIdx]).join(" ")}
          </text>
        )}

        {Array.from({ length: nDays }, (_, i) => (
          <rect key={i} x={groupX(i)} y={mTop} width={groupW} height={cH}
            fill="transparent" onMouseEnter={() => setHoverIdx(i)} />
        ))}
      </svg>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// DailyConditionCard — 5일 날씨 상태 비교 (소스별 이모지+텍스트)
// ══════════════════════════════════════════════════════════════════════════

function condToEmoji(cond) {
  if (!cond) return "—";
  const c = cond.trim();
  if (c.includes("뇌우") || c.includes("번개"))         return "⛈️";
  if (c.includes("폭설") || c.includes("강한 눈"))       return "❄️";
  if (c.includes("눈보라"))                              return "🌨️";
  if (c.includes("눈") || c.includes("설"))              return "🌨️";
  if (c.includes("진눈깨비") || c.includes("우박"))       return "🌧️";
  if (c.includes("폭우") || c.includes("강한 비"))       return "🌧️";
  if (c.includes("소나기"))                              return "🌦️";
  if (c.includes("비"))                                  return "🌧️";
  if (c.includes("이슬비"))                              return "🌦️";
  if (c.includes("안개"))                                return "🌫️";
  if (c.includes("흐림") || c.includes("흐린"))          return "☁️";
  if (c.includes("구름 많음") || c.includes("구름많음")) return "🌥️";
  if (c.includes("구름 조금") || c.includes("구름조금")) return "⛅";
  if (c.includes("구름"))                                return "🌤️";
  if (c.includes("맑음") || c.includes("청명"))          return "☀️";
  return "—";
}

export function DailyConditionCard({ dailyForecasts, owDailyForecasts, meteoDaily, wapiDailyForecasts, theme }) {
  const [activeSrcs, setActiveSrcs] = useState(["기상청"]);

  const toggleSrc = name => setActiveSrcs(prev =>
    prev.includes(name)
      ? prev.length > 1 ? prev.filter(n => n !== name) : prev
      : [...prev, name]
  );

  const sourceDefs = [
    { name: "기상청",    color: "#2563eb", days: dailyForecasts?.length    ? dailyForecasts.slice(0, 5).map(d => ({ date: d.date, condAm: d.condAm, condPm: d.condPm })) : null },
    { name: "ECMWF",     color: "#8B5CF6", days: owDailyForecasts?.length   ? owDailyForecasts.slice(0, 5).map(d => ({ date: d.date, condAm: d.condAm, condPm: d.condPm })) : null },
    { name: "오픈메테오",color: "#059669", days: meteoDaily?.length         ? meteoDaily.slice(1, 6).map(d => ({ date: d.dateLabel, condAm: d.condAm, condPm: d.condPm })) : null },
  ].filter(s => s.days?.some(d => d.condAm || d.condPm));

  if (!sourceDefs.length) return null;

  const nDays = Math.max(...sourceDefs.map(s => s.days.length));
  const refDates = sourceDefs[0].days.map(d => d.date);
  const activeDefs = sourceDefs.filter(s => activeSrcs.includes(s.name));

  return (
    <div>
      <ChartLegend sources={sourceDefs} theme={theme} activeSrcs={activeSrcs} onToggle={toggleSrc} />

      {/* 날짜별 컬럼 */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${nDays}, 1fr)`, gap: 6 }}>
        {Array.from({ length: nDays }, (_, i) => {
          const [day, dow] = splitDateLabel(refDates[i]);
          return (
            <div key={i} style={{
              background: "rgba(0,0,0,0.04)", borderRadius: 14,
              padding: "10px 4px 8px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: theme.text, lineHeight: 1.1 }}>{day}</p>
              <p style={{ fontSize: 9, color: theme.sub, lineHeight: 1 }}>{dow}</p>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginTop: 2, width: "100%" }}>
                {activeDefs.map(src => {
                  const am = src.days[i]?.condAm;
                  const pm = src.days[i]?.condPm;
                  return (
                    <div key={src.name} style={{ display: "flex", gap: 4, justifyContent: "center", width: "100%" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                        <span style={{ fontSize: 8, color: src.color, fontWeight: 700, marginBottom: 1 }}>오전</span>
                        <span style={{ fontSize: 18, lineHeight: 1 }}>{condToEmoji(am)}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                        <span style={{ fontSize: 8, color: src.color, fontWeight: 700, marginBottom: 1 }}>오후</span>
                        <span style={{ fontSize: 18, lineHeight: 1 }}>{condToEmoji(pm)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 소스별 미니 카드 버튼 */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {sourceDefs.map(src => {
          const isActive = activeSrcs.includes(src.name);
          const am = src.days[0]?.condAm;
          const pm = src.days[0]?.condPm;
          return (
            <div key={src.name}
              onClick={() => toggleSrc(src.name)}
              style={{
                flex: "1 1 0", minWidth: 60, padding: "8px 10px", borderRadius: 14,
                background: `${src.color}12`, borderLeft: `3px solid ${src.color}`,
                opacity: isActive ? 1 : 0.2, transition: "opacity 0.15s", cursor: "pointer",
              }}
            >
              <p style={{ fontSize: 10, fontWeight: 700, color: src.color, marginBottom: 4 }}>{src.name}</p>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 7.5, color: src.color, opacity: 0.7 }}>오전</div>
                  <span style={{ fontSize: 16 }}>{condToEmoji(am)}</span>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 7.5, color: src.color, opacity: 0.7 }}>오후</div>
                  <span style={{ fontSize: 16 }}>{condToEmoji(pm)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── PM2.5 등급 → 색상/라벨 ─────────────────────────────────────────────────
function gradeStyle(grade) {
  if (grade === "좋음")     return { bg: "#B3E5FC", color: "#0277BD", label: "좋음" };
  if (grade === "보통")     return { bg: "#C8E6C9", color: "#2E7D32", label: "보통" };
  if (grade === "나쁨")     return { bg: "#FFE0B2", color: "#E65100", label: "나쁨" };
  if (grade === "매우나쁨") return { bg: "#FFCDD2", color: "#B71C1C", label: "매우나쁨" };
  return { bg: "#EEEEEE", color: "#999", label: "—" };
}

export function DailyAirCard({ airForecast, theme }) {
  const [activeSrcs, setActiveSrcs] = useState(["에어코리아"]);
  const toggleSrc = name => setActiveSrcs(prev =>
    prev.includes(name) ? (prev.length > 1 ? prev.filter(n => n !== name) : prev) : [...prev, name]
  );

  const sources = [
    { name: "에어코리아", color: "#4A90D9", data: airForecast?.airkorea  || [] },
    { name: "ECMWF",     color: "#8B5CF6", data: airForecast?.ecmwf     || [] },
    { name: "오픈메테오", color: "#4CAF50", data: airForecast?.openmeteo || [] },
  ];

  // 모든 소스에서 dateLabel 수집 → 정렬된 고유 날짜 3개
  const allDates = [...new Set(sources.flatMap(s => s.data.map(d => d.dateLabel)))]
    .sort((a, b) => {
      const nums = s => (s.match(/\d+/g) || []).map(Number);
      const [am, ad] = nums(a); const [bm, bd] = nums(b);
      return am !== bm ? am - bm : ad - bd;
    })
    .slice(0, 3);

  return (
    <div style={{ background: theme.card, borderRadius: 16, padding: "18px 16px", marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 14 }}>🌫️ 3일 미세먼지 (PM2.5) 예보</h3>

      {/* 날짜 헤더 */}
      <div style={{ display: "grid", gridTemplateColumns: `72px repeat(${allDates.length}, 1fr)`, gap: 4, marginBottom: 6 }}>
        <div />
        {allDates.map(d => {
          const [day, dow] = splitDateLabel(d);
          return (
            <div key={d} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>{day}</div>
              <div style={{ fontSize: 10, color: theme.sub }}>{dow}</div>
            </div>
          );
        })}
      </div>

      {/* 소스별 행 */}
      {sources.map(src => {
        if (!activeSrcs.includes(src.name)) return null;
        const byDate = Object.fromEntries(src.data.map(d => [d.dateLabel, d]));
        return (
          <div key={src.name} style={{ display: "grid", gridTemplateColumns: `72px repeat(${allDates.length}, 1fr)`, gap: 4, marginBottom: 6, alignItems: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: src.color, paddingRight: 4 }}>{src.name}</div>
            {allDates.map(d => {
              const item = byDate[d];
              const gs = gradeStyle(item?.pm25Grade);
              return (
                <div key={d} style={{
                  textAlign: "center", borderRadius: 6, padding: "4px 2px",
                  background: item ? gs.bg : "transparent",
                }}>
                  <span style={{ fontSize: item?.pm25Grade === "매우나쁨" ? 9 : 11, fontWeight: 700, color: item ? gs.color : theme.sub }}>
                    {item ? gs.label : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* 미니카드 토글 */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {sources.map(src => {
          const isActive = activeSrcs.includes(src.name);
          const firstGrade = src.data[0]?.pm25Grade;
          const gs = gradeStyle(firstGrade);
          return (
            <div key={src.name} onClick={() => toggleSrc(src.name)} style={{
              flex: "1 1 0", minWidth: 60, borderRadius: 10, padding: "8px 6px",
              border: `2px solid ${isActive ? src.color : theme.border || "#ddd"}`,
              background: isActive ? src.color + "15" : "transparent",
              textAlign: "center", cursor: "pointer",
              opacity: isActive ? 1 : 0.4, transition: "opacity 0.15s",
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: src.color, marginBottom: 4 }}>{src.name}</p>
              <div style={{
                display: "inline-block", borderRadius: 5, padding: "2px 6px",
                background: firstGrade ? gs.bg : "transparent",
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: firstGrade ? gs.color : theme.sub }}>
                  {firstGrade ? gs.label : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── HourlyAirCard — 오늘 시간대별 미세먼지 꺾은선 (PM2.5) ───────────────
export function HourlyAirCard({ airHourly, openmeteoHourly, ecmwfHourly, theme }) {
  const [activeSrcs, setActiveSrcs] = useState(["에어코리아"]);
  const toggleSrc = name => setActiveSrcs(prev =>
    prev.includes(name) ? (prev.length > 1 ? prev.filter(n => n !== name) : prev) : [...prev, name]
  );

  const nowHour = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours();
  const nowTime = `${String(nowHour).padStart(2, "0")}:00`;

  // 에어코리아: 오늘 전체 실측값 — 3시간 이동평균으로 스무딩
  const smooth = (arr) => (arr || []).filter(h => h.time && h.pm25 != null).map((h, i, a) => {
    const win = a.slice(Math.max(0, i - 1), i + 2);
    const avg = win.reduce((s, x) => s + x.pm25, 0) / win.length;
    return { ...h, pm25: Math.round(avg) };
  });
  const akSlots = smooth(airHourly);

  // 예보 소스: 현재 시간 이후만
  const filterForecast = (arr) =>
    (arr || []).filter(h => h.time && parseInt(h.time.slice(0, 2), 10) >= nowHour && h.pm25 != null);
  const omSlots    = filterForecast(openmeteoHourly);
  const ecmwfSlots = filterForecast(ecmwfHourly);

  if (!akSlots.length && !omSlots.length && !ecmwfSlots.length) return null;

  const allTimes = [...new Set([
    ...akSlots.map(h => h.time),
    ...omSlots.map(h => h.time),
    ...ecmwfSlots.map(h => h.time),
  ])].sort();

  const allSources = [
    { name: "에어코리아", color: "#3B82F6", slots: akSlots },
    { name: "ECMWF",     color: "#8B5CF6", slots: ecmwfSlots },
    { name: "오픈메테오", color: "#10B981", slots: omSlots },
  ].filter(s => s.slots.length > 0);

  const sources = allSources.filter(s => activeSrcs.includes(s.name));

  // 동적 Y축: 활성 소스의 실제 최대값 기준 (등급 경계 포함)
  const activeVals = sources.flatMap(s => s.slots.map(h => h.pm25).filter(v => v != null));
  const dataMax = activeVals.length ? Math.max(...activeVals) : 0;
  const Y_MAX = dataMax <= 15 ? 25 : dataMax <= 35 ? 50 : dataMax <= 75 ? 90 : 110;

  const W = 320, H = 120, PAD_L = 28, PAD_R = 8, PAD_T = 8, PAD_B = 24;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const bands = [
    { from: 0,  to: 15, color: "#4ade8022" },
    { from: 15, to: 35, color: "#facc1522" },
    { from: 35, to: 75, color: "#fb923c22" },
    { from: 75, to: Y_MAX, color: "#f8717122" },
  ];
  // Y_MAX 이하에 걸치는 경계선만 표시
  const bandLabels = [
    { y: 15, label: "15" },
    { y: 35, label: "35" },
    { y: 75, label: "75" },
  ].filter(b => b.y < Y_MAX);

  const toX = (time) => {
    const idx = allTimes.indexOf(time);
    return PAD_L + (idx / Math.max(allTimes.length - 1, 1)) * chartW;
  };
  const toY = (val) =>
    PAD_T + chartH - (Math.min(val, Y_MAX) / Y_MAX) * chartH;

  const makePath = (slots) => {
    const pts = slots
      .filter(s => s.pm25 != null)
      .map(s => `${toX(s.time).toFixed(1)},${toY(s.pm25).toFixed(1)}`);
    return pts.length > 1 ? `M ${pts.join(" L ")}` : "";
  };

  // 현재 시간 X 위치
  const nowX = allTimes.includes(nowTime) ? toX(nowTime) : null;

  // X축 레이블: 4시간마다
  const xLabels = allTimes.filter((_, i) => i % 4 === 0);

  return (
    <div style={{ background: theme.card, borderRadius: 16, padding: "18px 16px", marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 14 }}>🕐 오늘 시간대별 미세먼지 (PM2.5)</h3>

      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: W, display: "block" }}>
          {/* 등급 음영 */}
          {bands.map((b, i) => {
            const yTop = toY(Math.min(b.to, Y_MAX));
            const yBot = toY(b.from);
            if (yBot <= yTop) return null;
            return <rect key={i} x={PAD_L} y={yTop} width={chartW} height={yBot - yTop} fill={b.color} />;
          })}

          {/* 등급 경계 점선 + 레이블 */}
          {bandLabels.map(({ y, label }) => (
            <g key={y}>
              <line x1={PAD_L} x2={PAD_L + chartW} y1={toY(y)} y2={toY(y)}
                stroke="rgba(0,0,0,0.12)" strokeWidth={0.8} strokeDasharray="3 3" />
              <text x={PAD_L - 3} y={toY(y) + 3.5} textAnchor="end"
                fontSize={8} fill={theme.sub} opacity={0.7}>{label}</text>
            </g>
          ))}

          {/* Y축 0 */}
          <text x={PAD_L - 3} y={toY(0) + 3.5} textAnchor="end" fontSize={8} fill={theme.sub} opacity={0.7}>0</text>

          {/* 현재 시간 세로선 — 좌=실측 / 우=예보 */}
          {nowX != null && (
            <g>
              <line x1={nowX} x2={nowX} y1={PAD_T} y2={PAD_T + chartH}
                stroke="rgba(0,0,0,0.25)" strokeWidth={1} strokeDasharray="3 2" />
              <text x={nowX + 2} y={PAD_T + 8} fontSize={7} fill={theme.sub} opacity={0.7}>지금</text>
            </g>
          )}

          {/* 꺾은선 */}
          {sources.map(src => {
            const d = makePath(src.slots);
            return d ? (
              <path key={src.name} d={d} fill="none"
                stroke={src.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            ) : null;
          })}

          {/* X축 레이블 */}
          {xLabels.map(t => (
            <text key={t} x={toX(t)} y={H - 6} textAnchor="middle"
              fontSize={8} fill={theme.sub} opacity={0.8}>{t.slice(0, 2)}시</text>
          ))}
        </svg>
      </div>

      {/* 소스 토글 미니카드 */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {allSources.map(src => {
          const isActive = activeSrcs.includes(src.name);
          const latestVal = src.slots[src.slots.length - 1]?.pm25 ?? src.slots[0]?.pm25;
          const gs = latestVal != null ? gradeStyle(pm25ToGradeStr(Math.round(latestVal))) : null;
          return (
            <div key={src.name} onClick={() => toggleSrc(src.name)} style={{
              flex: "1 1 0", minWidth: 60, borderRadius: 10, padding: "8px 6px",
              border: `2px solid ${isActive ? src.color : theme.border || "#ddd"}`,
              background: isActive ? src.color + "15" : "transparent",
              textAlign: "center", cursor: "pointer",
              opacity: isActive ? 1 : 0.4, transition: "opacity 0.15s",
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: src.color, marginBottom: 4 }}>{src.name}</p>
              <div style={{
                display: "inline-block", borderRadius: 5, padding: "2px 6px",
                background: gs ? gs.bg : "transparent",
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: gs ? gs.color : theme.sub }}>
                  {gs ? gs.label : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function pm25ToGradeStr(val) {
  if (val <= 15) return "좋음";
  if (val <= 35) return "보통";
  if (val <= 75) return "나쁨";
  return "매우나쁨";
}
