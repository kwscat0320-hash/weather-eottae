import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { createPortal } from "react-dom";
import { Plus, Search, X, MapPin, ChevronRight, Trash2, RotateCcw } from "lucide-react";
import { useWeather } from "../context/WeatherContext";

const STORAGE_KEY = "favorites_locations_v1";

// ── 지오코딩 ─────────────────────────────────────────────────────────────
async function searchLocations(query) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(query)}` +
    `&format=json&addressdetails=1&limit=8&accept-language=ko&countrycodes=kr`,
    { headers: { "Accept-Language": "ko" } }
  );
  const data = await res.json();
  return data.map(r => {
    const a = r.address || {};
    const district = a.borough || a.suburb || a.county || a.city_district || a.town || a.village || a.city || r.name;
    return {
      name: district || r.display_name.split(",")[0].trim(),
      admin1: a.city || a.county || a.state || "",
      country: a.country || "대한민국",
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      displayName: r.display_name,
    };
  }).filter((r, i, arr) =>
    arr.findIndex(x => Math.abs(x.lat - r.lat) < 0.01 && Math.abs(x.lng - r.lng) < 0.01) === i
  );
}

async function fetchWeather(lat, lng) {
  const res = await fetch(`/api/kma?lat=${lat}&lon=${lng}`);
  if (!res.ok) throw new Error("KMA fetch failed");
  return res.json();
}

function conditionToEmoji(condition) {
  if (!condition) return "🌡️";
  const c = condition;
  if (c.includes("뇌우")) return "⛈️";
  if (c.includes("눈") && c.includes("비")) return "🌨️";
  if (c.includes("눈")) return "❄️";
  if (c.includes("소나기")) return "🌦️";
  if (c.includes("비")) return "🌧️";
  if (c.includes("이슬비") || c.includes("안개비")) return "🌦️";
  if (c.includes("안개")) return "🌫️";
  if (c.includes("황사") || c.includes("먼지")) return "🌪️";
  if (c.includes("구름많음") || c.includes("흐림")) return "☁️";
  if (c.includes("구름조금") || c.includes("구름")) return "⛅";
  if (c.includes("맑음")) return "☀️";
  return "🌡️";
}

// ── 검색 모달 ──────────────────────────────────────────────────────────────
function SearchModal({ theme, onSelect, onClose }) {
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
        key="fav-search-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center" }}
      >
        <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }} />
        <motion.div
          initial={{ y: "-100%" }}
          animate={{ y: 0 }}
          exit={{ y: "-100%" }}
          transition={{ type: "spring", damping: 32, stiffness: 340 }}
          onClick={e => e.stopPropagation()}
          style={{
            position: "relative", zIndex: 1, width: "100%", maxWidth: "100%",
            background: theme.card, borderRadius: "0 0 28px 28px",
            padding: "60px 20px 24px", maxHeight: "80vh", display: "flex", flexDirection: "column",
          }}
        >
          <p style={{ fontSize: 16, fontWeight: 800, color: theme.text, marginBottom: 16 }}>지역 추가</p>

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
              placeholder="지역명 검색 (예: 강남구, 해운대구)"
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: theme.text }}
            />
            {query && <button onClick={() => handleChange("")}><X size={14} style={{ color: theme.sub }} /></button>}
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading && <p style={{ fontSize: 13, color: theme.sub, textAlign: "center", padding: "20px 0" }}>검색 중...</p>}
            {!loading && results.length === 0 && query && (
              <p style={{ fontSize: 13, color: theme.sub, textAlign: "center", padding: "20px 0" }}>검색 결과가 없어요</p>
            )}
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => onSelect(r)}
                style={{
                  width: "100%", textAlign: "left", padding: "12px 4px",
                  borderBottom: i < results.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 12,
                }}
              >
                <MapPin size={16} style={{ color: "#3B82F6", flexShrink: 0 }} />
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

// ── 상세 날씨 모달 ─────────────────────────────────────────────────────────
const CURRENT_ID = "__current__";

function DetailModal({ initialId, theme, onClose, favorites, weathers }) {
  const { currentWeather: ctxCurrent, forecast: ctxForecast, displayLocation } = useWeather();
  const [selectedId, setSelectedId] = useState(initialId ?? CURRENT_ID);
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

  const currentLocationWeather = { current: ctxCurrent, forecast: ctxForecast ?? [] };

  const allLocations = [
    { id: CURRENT_ID, name: displayLocation || "현재위치", isCurrent: true },
    ...favorites,
  ];

  const activeLocation = allLocations.find(l => l.id === selectedId) ?? allLocations[0];
  const activeWeather = selectedId === CURRENT_ID ? currentLocationWeather : weathers[selectedId];

  const cur = activeWeather?.current;
  const forecast = activeWeather?.forecast ?? [];

  const dailyMap = {};
  forecast.forEach(f => {
    if (!dailyMap[f.dateLabel]) dailyMap[f.dateLabel] = [];
    dailyMap[f.dateLabel].push(f);
  });
  const dailyEntries = Object.entries(dailyMap).slice(0, 5);
  const hourlySlots = forecast.slice(0, 24);

  const content = (
    <AnimatePresence>
      <motion.div
        key="fav-detail-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}
      >
        <div onClick={dismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }} />
        <motion.div
          drag="y"
          dragConstraints={{ top: 0 }}
          dragElastic={{ top: 0.05, bottom: 0.8 }}
          onDragEnd={handleDragEnd}
          animate={controls}
          initial={{ y: "100%" }}
          onClick={e => e.stopPropagation()}
          style={{
            position: "relative", zIndex: 1, width: "100%", maxWidth: "100%",
            background: theme.cardsBg ?? "#f1f5f9",
            borderRadius: "28px 28px 0 0", maxHeight: "92vh", overflowY: "auto", scrollbarWidth: "none",
            cursor: "grab",
          }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.15)", margin: "16px auto 0" }} />

          {/* 헤더 */}
          <div style={{ padding: "16px 20px 20px", background: theme.card, borderRadius: "28px 28px 0 0", marginBottom: 8 }}>
            {/* 지역 탭 */}
            <div style={{ overflowX: "auto", scrollbarWidth: "none", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 8, minWidth: "max-content" }}>
                {allLocations.map(loc => {
                  const isActive = loc.id === selectedId;
                  return (
                    <button
                      key={loc.id}
                      onClick={e => { e.stopPropagation(); setSelectedId(loc.id); }}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 20,
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                        background: isActive ? "#3B82F6" : "rgba(0,0,0,0.06)",
                        color: isActive ? "#fff" : theme.sub,
                        display: "flex", alignItems: "center", gap: 5,
                        transition: "all 0.15s",
                        flexShrink: 0,
                      }}
                    >
                      {loc.isCurrent && <span style={{ fontSize: 11 }}>📍</span>}
                      {loc.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button
                onClick={dismiss}
                style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: 20, padding: "4px 12px", cursor: "pointer", fontSize: 12, color: theme.sub }}
              >닫기</button>
            </div>

            <p style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>{activeLocation?.name}</p>
            {!activeLocation?.isCurrent && (
              <p style={{ fontSize: 11, color: theme.sub, marginBottom: 12 }}>
                {[activeLocation?.admin1, activeLocation?.country].filter(Boolean).join(", ")}
              </p>
            )}

            {cur && (
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12 }}>
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
            {/* 시간별 */}
            {hourlySlots.length > 0 && (
              <div style={{ background: theme.card, borderRadius: 20, padding: "16px" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: theme.sub, marginBottom: 14 }}>시간별 예보</p>
                <div style={{ overflowX: "auto", scrollbarWidth: "none" }}>
                  <div style={{ display: "flex", gap: 14, minWidth: "max-content" }}>
                    {hourlySlots.map((f, i) => (
                      <div key={i} style={{ textAlign: "center", minWidth: 44 }}>
                        <p style={{ fontSize: 11, color: theme.sub, marginBottom: 6 }}>{f.timeLabel}</p>
                        <p style={{ fontSize: 18, marginBottom: 4 }}>{conditionToEmoji(f.condition)}</p>
                        <p style={{ fontSize: 14, fontWeight: 800, color: theme.text }}>{f.temp != null ? `${Number(f.temp).toFixed(0)}°` : "—"}</p>
                        <p style={{ fontSize: 10, color: "#3B82F6", marginTop: 4 }}>{f.rainChance}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 일별 */}
            {dailyEntries.length > 0 && (
              <div style={{ background: theme.card, borderRadius: 20, padding: "16px" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: theme.sub, marginBottom: 12 }}>일별 예보</p>
                {dailyEntries.map(([dateLabel, slots], i) => {
                  const temps = slots.map(s => s.temp).filter(v => v != null);
                  const maxTemp = slots[0]?.officialTMX ?? (temps.length ? Math.max(...temps) : null);
                  const minTemp = slots[0]?.officialTMN ?? (temps.length ? Math.min(...temps) : null);
                  const rainMax = Math.max(...slots.map(s => s.rainChance ?? 0));
                  const cond = slots[Math.floor(slots.length / 2)]?.condition ?? "";
                  return (
                    <div key={dateLabel} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 0",
                      borderBottom: i < dailyEntries.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                    }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: theme.text, width: 100 }}>{dateLabel}</p>
                      <p style={{ fontSize: 20, flex: 1, textAlign: "center" }}>{conditionToEmoji(cond)}</p>
                      <p style={{ fontSize: 11, color: "#3B82F6", width: 36, textAlign: "right" }}>{rainMax}%</p>
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

// ── 관심지역 날씨 카드 ────────────────────────────────────────────────────
function FavoriteCard({ location, weather, loading, theme, onClick, onDelete }) {
  const cur = weather?.current;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={cur ? onClick : undefined}
      style={{
        background: theme.card, borderRadius: 20, padding: "16px 16px 14px",
        cursor: cur ? "pointer" : "default",
        borderLeft: "4px solid #3B82F6",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <MapPin size={13} style={{ color: "#3B82F6" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#3B82F6" }}>관심지역</span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 8 }}
        >
          <Trash2 size={14} style={{ color: theme.sub, opacity: 0.5 }} />
        </button>
      </div>

      {loading ? (
        <div>
          <p style={{ fontSize: 16, fontWeight: 800, color: theme.text }}>{location.name}</p>
          <p style={{ fontSize: 12, color: theme.sub, marginTop: 4 }}>날씨 불러오는 중...</p>
        </div>
      ) : cur ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: theme.text }}>{location.name}</p>
            <p style={{ fontSize: 10, color: theme.sub, marginBottom: 8 }}>
              {[location.admin1, location.country].filter(Boolean).join(", ")}
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 34, fontWeight: 800, color: theme.text }}>{Number(cur.temp).toFixed(1)}°</span>
            </div>
            <p style={{ fontSize: 12, color: theme.sub }}>{cur.condition}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>
              최고 {Number(cur.high).toFixed(1)}° / 최저 {Number(cur.low).toFixed(1)}°
            </p>
            <p style={{ fontSize: 11, color: theme.sub, marginTop: 4 }}>강수 {cur.rainChance}%</p>
            <p style={{ fontSize: 11, color: theme.sub, marginTop: 2 }}>습도 {cur.humidity}% · 체감 {Number(cur.feelsLike).toFixed(1)}°</p>
          </div>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 16, fontWeight: 800, color: theme.text }}>{location.name}</p>
          <p style={{ fontSize: 12, color: theme.sub, marginTop: 4 }}>날씨를 불러올 수 없어요</p>
        </div>
      )}
    </motion.div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────────────────────
export default function FavoritesPage({ scrollRef }) {
  const { theme } = useWeather();

  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  });
  const [weathers, setWeathers] = useState({});   // key: location index id
  const [loadings, setLoadings] = useState({});
  const [showSearch, setShowSearch] = useState(false);
  const [detailTarget, setDetailTarget] = useState(null); // { location, id }

  const fetchOne = useCallback(async (id, location) => {
    setLoadings(prev => ({ ...prev, [id]: true }));
    try {
      const data = await fetchWeather(location.lat, location.lng);
      setWeathers(prev => ({ ...prev, [id]: data }));
    } catch {
      setWeathers(prev => ({ ...prev, [id]: null }));
    } finally {
      setLoadings(prev => ({ ...prev, [id]: false }));
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    favorites.forEach(fav => fetchOne(fav.id, fav));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = (location) => {
    const id = `${location.lat.toFixed(4)}_${location.lng.toFixed(4)}`;
    // 중복 확인
    if (favorites.some(f => f.id === id)) { setShowSearch(false); return; }
    const newFav = { ...location, id };
    const next = [...favorites, newFav];
    setFavorites(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setShowSearch(false);
    fetchOne(id, newFav);
  };

  const handleDelete = (id) => {
    const next = favorites.filter(f => f.id !== id);
    setFavorites(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setWeathers(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleRefreshAll = () => {
    favorites.forEach(fav => fetchOne(fav.id, fav));
  };

  return (
    <div
      className={`flex-1 bg-gradient-to-b ${theme.bg} relative overflow-hidden`}
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      <div ref={scrollRef} className="absolute inset-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {/* 헤더 */}
        <div className="px-6 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 24px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p className="text-xs mb-1" style={{ color: theme.sub }}>관심지역</p>
              <h1 className="text-xl font-bold" style={{ color: theme.text }}>저장한 지역</h1>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {favorites.length > 0 && (
                <button
                  onClick={handleRefreshAll}
                  style={{
                    background: "rgba(0,0,0,0.06)", borderRadius: 20,
                    padding: "8px 12px", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <RotateCcw size={14} style={{ color: theme.sub }} />
                </button>
              )}
              <button
                onClick={() => setShowSearch(true)}
                style={{
                  background: "#3B82F6", borderRadius: 20,
                  padding: "8px 16px", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <Plus size={14} style={{ color: "#fff" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>추가</span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-32" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {favorites.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>📍</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: theme.text, marginBottom: 6 }}>
                아직 저장한 지역이 없어요
              </p>
              <p style={{ fontSize: 12, color: theme.sub }}>
                + 추가 버튼을 눌러 지역을 추가해보세요
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {favorites.map(fav => (
                <FavoriteCard
                  key={fav.id}
                  location={fav}
                  weather={weathers[fav.id]}
                  loading={!!loadings[fav.id]}
                  theme={theme}
                  onClick={() => setDetailTarget({ location: fav, id: fav.id })}
                  onDelete={() => handleDelete(fav.id)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* 검색 모달 */}
      {showSearch && (
        <SearchModal
          theme={theme}
          onSelect={handleAdd}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* 상세 모달 */}
      {detailTarget && (
        <DetailModal
          initialId={detailTarget.id}
          theme={theme}
          onClose={() => setDetailTarget(null)}
          favorites={favorites}
          weathers={weathers}
        />
      )}
    </div>
  );
}
