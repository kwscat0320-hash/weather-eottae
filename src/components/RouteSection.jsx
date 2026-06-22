import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { Search, X, MapPin, ChevronRight, RotateCcw } from "lucide-react";

const STORAGE_KEY = "route_locations_v1";

const ROLES = [
  { key: "from", label: "출발지", emoji: "🚩", color: "#10B981" },
  { key: "via",  label: "경유지", emoji: "📍", color: "#F59E0B" },
  { key: "to",   label: "도착지", emoji: "🏁", color: "#EF4444" },
];

async function searchLocations(query) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(query)}` +
    `&format=json&addressdetails=1&limit=8&accept-language=ko&countrycodes=kr`,
    { headers: { "Accept-Language": "ko" } }
  );
  const data = await res.json();

  // 구/시/동 단위로 표시명 정리
  return data.map(r => {
    const a = r.address || {};
    // 표시할 이름: 구 > 시군구 > 읍면동 순
    const district = a.borough || a.suburb || a.county || a.city_district || a.town || a.village || a.city || r.name;
    const city     = a.city || a.county || a.state;
    const name     = district !== city ? district : district;
    return {
      name:    name || r.display_name.split(",")[0].trim(),
      admin1:  a.city || a.county || a.state || "",
      country: a.country || "대한민국",
      lat:     parseFloat(r.lat),
      lng:     parseFloat(r.lon),
      displayName: r.display_name,
    };
  }).filter((r, i, arr) =>
    // 중복 좌표 제거 (소수점 2자리 기준)
    arr.findIndex(x => Math.abs(x.lat - r.lat) < 0.01 && Math.abs(x.lng - r.lng) < 0.01) === i
  );
}

async function fetchLocationWeather(lat, lng) {
  const res = await fetch(`/api/kma?lat=${lat}&lon=${lng}`);
  if (!res.ok) throw new Error("KMA fetch failed");
  return res.json(); // { current, forecast }
}

// ── 위치 검색 모달 ─────────────────────────────────────────────────────────
function SearchModal({ role, theme, onSelect, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleChange = (v) => {
    setQuery(v);
    clearTimeout(timer.current);
    if (!v.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try { setResults(await searchLocations(v)); }
      catch { setResults([]); }
      finally { setLoading(false); }
    }, 400);
  };

  const content = (
    <AnimatePresence>
      <motion.div
        key="search-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "flex-start", justifyContent: "center",
        }}
      >
        <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }} />
        <motion.div
          initial={{ y: "-100%" }}
          animate={{ y: 0 }}
          exit={{ y: "-100%" }}
          transition={{ type: "spring", damping: 32, stiffness: 340 }}
          onClick={e => e.stopPropagation()}
          style={{
            position: "relative", zIndex: 1,
            width: "100%", maxWidth: 393,
            background: theme.card,
            borderRadius: "0 0 28px 28px",
            padding: "60px 20px 24px",
            maxHeight: "80vh", display: "flex", flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 18 }}>{role.emoji}</span>
            <p style={{ fontSize: 16, fontWeight: 800, color: theme.text }}>{role.label} 검색</p>
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(0,0,0,0.06)", borderRadius: 14,
            padding: "10px 14px", marginBottom: 12,
          }}>
            <Search size={16} style={{ color: theme.sub, flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => handleChange(e.target.value)}
              placeholder="지역명 입력 (예: 강남, 부산, 제주)"
              style={{
                flex: 1, border: "none", outline: "none",
                background: "transparent", fontSize: 14,
                color: theme.text,
              }}
            />
            {query && (
              <button onClick={() => handleChange("")}>
                <X size={14} style={{ color: theme.sub }} />
              </button>
            )}
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading && (
              <p style={{ fontSize: 13, color: theme.sub, textAlign: "center", padding: "20px 0" }}>검색 중...</p>
            )}
            {!loading && results.length === 0 && query && (
              <p style={{ fontSize: 13, color: theme.sub, textAlign: "center", padding: "20px 0" }}>검색 결과가 없어요</p>
            )}
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => onSelect({ name: r.name, admin1: r.admin1, country: r.country, lat: r.lat, lng: r.lng })}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "12px 4px",
                  borderBottom: i < results.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 12,
                }}
              >
                <MapPin size={16} style={{ color: role.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{r.name}</p>
                  <p style={{ fontSize: 11, color: theme.sub, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.displayName}
                  </p>
                </div>
                <ChevronRight size={14} style={{ color: theme.sub, flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

// ── 날씨 카드 ──────────────────────────────────────────────────────────────
function RouteCard({ role, location, weather, loading, theme, onEdit, onRemove, onDetail }) {
  // weather = { current, forecast } (KMA 전체 응답)
  const cur       = weather?.current;
  const temp      = cur?.temp;
  const feelsLike = cur?.feelsLike;
  const high      = cur?.high;
  const low       = cur?.low;
  const rain      = cur?.rainChance;
  const humidity  = cur?.humidity;
  const condition = cur?.condition ?? "";

  const clickable = !!(cur && onDetail);

  return (
    <div
      onClick={clickable ? onDetail : undefined}
      style={{
        background: theme.card,
        borderRadius: 20,
        padding: "16px 16px 14px",
        borderLeft: `4px solid ${role.color}`,
        cursor: clickable ? "pointer" : "default",
      }}
    >
      {/* 역할 + 버튼 영역 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 15 }}>{role.emoji}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: role.color }}>{role.label}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {location && (
            <button
              onClick={e => { e.stopPropagation(); onEdit(); }}
              style={{
                fontSize: 11, color: theme.sub,
                background: "rgba(0,0,0,0.06)", padding: "3px 10px",
                borderRadius: 20, border: "none", cursor: "pointer",
              }}
            >
              변경
            </button>
          )}
          {onRemove && (
            <button
              onClick={e => { e.stopPropagation(); onRemove(); }}
              style={{
                fontSize: 11, color: "#EF4444",
                background: "#FEE2E2", padding: "3px 10px",
                borderRadius: 20, border: "none", cursor: "pointer",
              }}
            >
              삭제
            </button>
          )}
        </div>
      </div>

      {!location ? (
        <button
          onClick={onEdit}
          style={{
            width: "100%", padding: "16px 0",
            background: "none", border: `1.5px dashed ${role.color}40`,
            borderRadius: 12, cursor: "pointer",
            color: role.color, fontSize: 13, fontWeight: 600,
          }}
        >
          + {role.label} 설정하기
        </button>
      ) : loading ? (
        <div>
          <p style={{ fontSize: 16, fontWeight: 800, color: theme.text }}>{location.name}</p>
          <p style={{ fontSize: 12, color: theme.sub, marginTop: 4 }}>날씨 불러오는 중...</p>
        </div>
      ) : weather ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, color: theme.text }}>{location.name}</p>
            <p style={{ fontSize: 10, color: theme.sub, marginBottom: 6 }}>
              {[location.admin1, location.country].filter(Boolean).join(", ")}
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: theme.text }}>{Number(temp).toFixed(1)}°</span>
            </div>
            <p style={{ fontSize: 12, color: theme.sub }}>{condition}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>
              최고 {Number(high).toFixed(1)}° / 최저 {Number(low).toFixed(1)}°
            </p>
            <p style={{ fontSize: 11, color: theme.sub, marginTop: 3 }}>강수 {rain ?? 0}%</p>
            <p style={{ fontSize: 11, color: theme.sub, marginTop: 2 }}>습도 {humidity}% · 체감 {Number(feelsLike).toFixed(1)}°</p>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: theme.sub }}>날씨를 불러올 수 없어요</p>
      )}
    </div>
  );
}

// ── 상세 날씨 모달 ────────────────────────────────────────────────────────
function RouteDetailModal({ location, role, weather, theme, onClose }) {
  const cur      = weather?.current;
  const forecast = weather?.forecast ?? [];

  // 오늘 날짜 기준 일별 그룹
  const dailyMap = {};
  forecast.forEach(f => {
    if (!dailyMap[f.dateLabel]) dailyMap[f.dateLabel] = [];
    dailyMap[f.dateLabel].push(f);
  });
  const dailyEntries = Object.entries(dailyMap).slice(0, 5);

  // 시간별 (오늘 + 내일까지 24개)
  const nowHour = new Date(Date.now() + 9 * 3600 * 1000).getUTCHours();
  const hourlySlots = forecast
    .filter(f => {
      const h = parseInt(f.timeLabel?.slice(0, 2) ?? "0", 10);
      return f === forecast[0] || true; // 앞에서부터 24개
    })
    .slice(0, 24);

  const content = (
    <AnimatePresence>
      <motion.div
        key="route-detail-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center",
        }}
      >
        {/* 배경 */}
        <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }} />

        {/* 시트 */}
        <motion.div
          drag="y"
          dragConstraints={{ top: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (info.velocity.y > 500 || info.offset.y > 150) onClose();
          }}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 32, stiffness: 340 }}
          onClick={e => e.stopPropagation()}
          style={{
            position: "relative", zIndex: 1,
            width: "100%", maxWidth: 393,
            background: theme.cardsBg ?? "#f1f5f9",
            borderRadius: "28px 28px 0 0",
            maxHeight: "92vh", overflowY: "auto",
            scrollbarWidth: "none",
            cursor: "grab",
          }}
        >
          {/* 핸들 */}
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.15)", margin: "16px auto 0" }} />

          {/* 헤더 */}
          <div style={{
            padding: "16px 20px 20px",
            background: theme.card,
            borderRadius: "28px 28px 0 0",
            marginBottom: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{role.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: role.color }}>{role.label}</span>
              </div>
              <button
                onClick={onClose}
                style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: 20, padding: "4px 12px", cursor: "pointer", fontSize: 12, color: theme.sub }}
              >
                닫기
              </button>
            </div>

            <p style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>{location.name}</p>
            <p style={{ fontSize: 11, color: theme.sub, marginBottom: 12 }}>
              {[location.admin1, location.country].filter(Boolean).join(", ")}
            </p>

            {cur && (
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: 52, fontWeight: 800, color: theme.text, lineHeight: 1 }}>
                    {Number(cur.temp).toFixed(1)}°
                  </span>
                  <p style={{ fontSize: 14, color: theme.sub, marginTop: 4 }}>{cur.condition}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>
                    최고 {Number(cur.high).toFixed(1)}° / 최저 {Number(cur.low).toFixed(1)}°
                  </p>
                  <p style={{ fontSize: 12, color: theme.sub, marginTop: 4 }}>체감 {Number(cur.feelsLike).toFixed(1)}°</p>
                  <p style={{ fontSize: 12, color: theme.sub, marginTop: 2 }}>강수 {cur.rainChance}% · 습도 {cur.humidity}%</p>
                  <p style={{ fontSize: 12, color: theme.sub, marginTop: 2 }}>바람 {Number(cur.wind).toFixed(1)}m/s</p>
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: "0 12px 40px", display: "flex", flexDirection: "column", gap: 10 }}>

            {/* 시간별 예보 */}
            {hourlySlots.length > 0 && (
              <div style={{ background: theme.card, borderRadius: 20, padding: "16px 16px" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: theme.sub, marginBottom: 14 }}>시간별 예보</p>
                <div style={{ overflowX: "auto", scrollbarWidth: "none" }}>
                  <div style={{ display: "flex", gap: 14, minWidth: "max-content" }}>
                    {hourlySlots.map((f, i) => (
                      <div key={i} style={{ textAlign: "center", minWidth: 44 }}>
                        <p style={{ fontSize: 11, color: theme.sub, marginBottom: 6 }}>{f.timeLabel}</p>
                        <p style={{ fontSize: 11, color: theme.sub, marginBottom: 4 }}>{f.condition?.slice(0, 2)}</p>
                        <p style={{ fontSize: 14, fontWeight: 800, color: theme.text }}>{f.temp != null ? `${Number(f.temp).toFixed(0)}°` : "—"}</p>
                        <p style={{ fontSize: 10, color: "#3B82F6", marginTop: 4 }}>{f.rainChance}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 일별 예보 */}
            {dailyEntries.length > 0 && (
              <div style={{ background: theme.card, borderRadius: 20, padding: "16px 16px" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: theme.sub, marginBottom: 12 }}>일별 예보</p>
                {dailyEntries.map(([dateLabel, slots], i) => {
                  const temps = slots.map(s => s.temp).filter(v => v != null);
                  const maxTemp = slots[0]?.officialTMX ?? (temps.length ? Math.max(...temps) : null);
                  const minTemp = slots[0]?.officialTMN ?? (temps.length ? Math.min(...temps) : null);
                  const rainMax = Math.max(...slots.map(s => s.rainChance ?? 0));
                  const cond    = slots[Math.floor(slots.length / 2)]?.condition ?? "";
                  return (
                    <div key={dateLabel} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 0",
                      borderBottom: i < dailyEntries.length - 1 ? `1px solid rgba(0,0,0,0.06)` : "none",
                    }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: theme.text, width: 100 }}>{dateLabel}</p>
                      <p style={{ fontSize: 12, color: theme.sub, flex: 1, textAlign: "center" }}>{cond}</p>
                      <p style={{ fontSize: 11, color: "#3B82F6", width: 36, textAlign: "right" }}>
                        {rainMax}%
                      </p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: theme.text, width: 80, textAlign: "right" }}>
                        {minTemp != null ? `${Number(minTemp).toFixed(0)}°` : "—"} / {maxTemp != null ? `${Number(maxTemp).toFixed(0)}°` : "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

// ── 경로 연결선 ────────────────────────────────────────────────────────────
function Connector({ theme }) {
  return (
    <div style={{ display: "flex", alignItems: "center", paddingLeft: 22 }}>
      <div style={{ width: 2, height: 20, background: `${theme.sub}25`, borderRadius: 1 }} />
    </div>
  );
}

// ── 메인 섹션 컴포넌트 ────────────────────────────────────────────────────
export default function RouteSection({ theme }) {
  const [route, setRoute] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { from: null, via: null, to: null }; }
    catch { return { from: null, via: null, to: null }; }
  });

  // 경유지 표시 여부: 저장된 경유지가 있으면 처음부터 보임
  const [showVia, setShowVia] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return !!(saved?.via);
    } catch { return false; }
  });

  const [weathers, setWeathers] = useState({ from: null, via: null, to: null });
  const [loadings, setLoadings] = useState({ from: false, via: false, to: false });
  const [searching, setSearching] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null); // { key, role, location }

  const fetchWeather = useCallback(async (key, location) => {
    if (!location) return;
    setLoadings(prev => ({ ...prev, [key]: true }));
    try {
      const data = await fetchLocationWeather(location.lat, location.lng);
      setWeathers(prev => ({ ...prev, [key]: data }));
    } catch {
      setWeathers(prev => ({ ...prev, [key]: null }));
    } finally {
      setLoadings(prev => ({ ...prev, [key]: false }));
    }
  }, []);

  useEffect(() => {
    ["from", "via", "to"].forEach(key => { if (route[key]) fetchWeather(key, route[key]); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (key, location) => {
    const next = { ...route, [key]: location };
    setRoute(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSearching(null);
    fetchWeather(key, location);
  };

  // 경유지 삭제
  const handleRemoveVia = () => {
    const next = { ...route, via: null };
    setRoute(next);
    setWeathers(prev => ({ ...prev, via: null }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setShowVia(false);
  };

  // 경유지 추가
  const handleAddVia = () => {
    setShowVia(true);
    setSearching("via");
  };

  const handleRefresh = () => {
    ["from", "via", "to"].forEach(key => { if (route[key]) fetchWeather(key, route[key]); });
  };

  const FROM_ROLE = ROLES[0]; // 출발지
  const VIA_ROLE  = ROLES[1]; // 경유지
  const TO_ROLE   = ROLES[2]; // 도착지

  return (
    <>
      {/* 섹션 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 4, paddingRight: 4 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: theme.sub, opacity: 0.6, letterSpacing: "0.08em" }}>
          경로 날씨
        </p>
        <button
          onClick={handleRefresh}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "none", border: "none", cursor: "pointer",
            color: theme.sub, fontSize: 11, opacity: 0.6,
          }}
        >
          <RotateCcw size={11} />
          새로고침
        </button>
      </div>

      {/* 출발지 */}
      <RouteCard
        role={FROM_ROLE}
        location={route.from}
        weather={weathers.from}
        loading={loadings.from}
        theme={theme}
        onEdit={() => setSearching("from")}
        onDetail={route.from && weathers.from ? () => setDetailTarget({ key: "from", role: FROM_ROLE, location: route.from }) : undefined}
      />

      {/* 경유지 연결선 + 카드 or 추가 버튼 */}
      <Connector theme={theme} />
      {showVia ? (
        <RouteCard
          role={VIA_ROLE}
          location={route.via}
          weather={weathers.via}
          loading={loadings.via}
          theme={theme}
          onEdit={() => setSearching("via")}
          onRemove={handleRemoveVia}
          onDetail={route.via && weathers.via ? () => setDetailTarget({ key: "via", role: VIA_ROLE, location: route.via }) : undefined}
        />
      ) : (
        <button
          onClick={handleAddVia}
          style={{
            width: "100%", padding: "12px 16px",
            background: theme.card,
            border: `1.5px dashed ${VIA_ROLE.color}50`,
            borderRadius: 16, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <span style={{ fontSize: 14 }}>{VIA_ROLE.emoji}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: VIA_ROLE.color }}>경유지 추가하기</span>
        </button>
      )}

      {/* 도착지 연결선 + 카드 */}
      <Connector theme={theme} />
      <RouteCard
        role={TO_ROLE}
        location={route.to}
        weather={weathers.to}
        loading={loadings.to}
        theme={theme}
        onEdit={() => setSearching("to")}
        onDetail={route.to && weathers.to ? () => setDetailTarget({ key: "to", role: TO_ROLE, location: route.to }) : undefined}
      />

      {/* 검색 모달 */}
      {searching && (
        <SearchModal
          role={ROLES.find(r => r.key === searching)}
          theme={theme}
          onSelect={(loc) => handleSelect(searching, loc)}
          onClose={() => { setSearching(null); if (!route.via) setShowVia(false); }}
        />
      )}

      {/* 지역 상세 날씨 모달 */}
      {detailTarget && (
        <RouteDetailModal
          location={detailTarget.location}
          role={detailTarget.role}
          weather={weathers[detailTarget.key]}
          theme={theme}
          onClose={() => setDetailTarget(null)}
        />
      )}
    </>
  );
}
