import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { Navigation, Search, X, RotateCcw, ChevronRight, MapPin } from "lucide-react";
import { useWeather } from "../context/WeatherContext";

const STORAGE_KEY = "route_locations_v1";

const ROLES = [
  { key: "from", label: "출발지", emoji: "🚩", color: "#10B981" },
  { key: "via",  label: "경유지", emoji: "📍", color: "#F59E0B" },
  { key: "to",   label: "도착지", emoji: "🏁", color: "#EF4444" },
];

// ── Open-Meteo 지오코딩 ───────────────────────────────────────────────────
async function searchLocations(query) {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=ko&format=json`
  );
  const data = await res.json();
  return data.results || [];
}

// ── Open-Meteo 날씨 조회 ──────────────────────────────────────────────────
async function fetchLocationWeather(lat, lng) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,apparent_temperature,precipitation,weathercode,windspeed_10m,relativehumidity_2m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode` +
    `&timezone=Asia/Seoul&forecast_days=1`
  );
  return res.json();
}

function codeToWeather(code) {
  if (code === 0)  return { label: "맑음",   emoji: "☀️" };
  if (code <= 3)   return { label: "구름조금", emoji: "⛅" };
  if (code <= 49)  return { label: "안개",   emoji: "🌫️" };
  if (code <= 59)  return { label: "이슬비", emoji: "🌦️" };
  if (code <= 69)  return { label: "비",     emoji: "🌧️" };
  if (code <= 79)  return { label: "눈",     emoji: "❄️" };
  if (code <= 82)  return { label: "소나기", emoji: "🌦️" };
  if (code <= 99)  return { label: "뇌우",   emoji: "⛈️" };
  return            { label: "흐림",   emoji: "☁️" };
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
            position: "relative", zIndex: 1,
            width: "100%", maxWidth: 393,
            background: theme.card,
            borderRadius: "0 0 28px 28px",
            padding: "60px 20px 24px",
            maxHeight: "80vh", display: "flex", flexDirection: "column",
          }}
        >
          {/* 제목 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 18 }}>{role.emoji}</span>
            <p style={{ fontSize: 16, fontWeight: 800, color: theme.text }}>{role.label} 검색</p>
          </div>

          {/* 검색창 */}
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

          {/* 결과 목록 */}
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
                onClick={() => onSelect({ name: r.name, country: r.country, admin1: r.admin1, lat: r.latitude, lng: r.longitude })}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "12px 4px",
                  borderBottom: i < results.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 12,
                }}
              >
                <MapPin size={16} style={{ color: role.color, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{r.name}</p>
                  <p style={{ fontSize: 11, color: theme.sub, marginTop: 2 }}>
                    {[r.admin1, r.country].filter(Boolean).join(", ")}
                  </p>
                </div>
                <ChevronRight size={14} style={{ color: theme.sub, marginLeft: "auto" }} />
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
function RouteWeatherCard({ role, location, weather, loading, theme, onEdit }) {
  const cond = weather ? codeToWeather(weather.daily.weathercode[0]) : null;
  const temp = weather?.current?.temperature_2m;
  const feelsLike = weather?.current?.apparent_temperature;
  const high = weather?.daily?.temperature_2m_max[0];
  const low = weather?.daily?.temperature_2m_min[0];
  const rain = weather?.daily?.precipitation_probability_max[0];
  const humidity = weather?.current?.relativehumidity_2m;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background: theme.card,
        borderRadius: 24,
        padding: "20px 20px 18px",
        borderLeft: `4px solid ${role.color}`,
        position: "relative",
      }}
    >
      {/* 역할 라벨 + 편집 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>{role.emoji}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: role.color }}>{role.label}</span>
        </div>
        <button
          onClick={onEdit}
          style={{ fontSize: 11, color: theme.sub, background: "rgba(0,0,0,0.06)", padding: "3px 10px", borderRadius: 20, border: "none", cursor: "pointer" }}
        >
          변경
        </button>
      </div>

      {!location ? (
        // 미설정 상태
        <button
          onClick={onEdit}
          style={{
            width: "100%", padding: "20px 0", background: "none", border: `1.5px dashed ${role.color}40`,
            borderRadius: 16, cursor: "pointer", color: role.color, fontSize: 14, fontWeight: 600,
          }}
        >
          + {role.label} 설정하기
        </button>
      ) : loading ? (
        <div style={{ padding: "12px 0" }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: theme.text, marginBottom: 2 }}>{location.name}</p>
          <p style={{ fontSize: 12, color: theme.sub }}>날씨 불러오는 중...</p>
        </div>
      ) : weather ? (
        <div>
          {/* 지역명 */}
          <p style={{ fontSize: 17, fontWeight: 800, color: theme.text, marginBottom: 2 }}>{location.name}</p>
          <p style={{ fontSize: 11, color: theme.sub, marginBottom: 12 }}>
            {[location.admin1, location.country].filter(Boolean).join(", ")}
          </p>

          {/* 날씨 메인 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 38, fontWeight: 800, color: theme.text }}>{Math.round(temp)}°</span>
                <span style={{ fontSize: 22 }}>{cond.emoji}</span>
              </div>
              <p style={{ fontSize: 13, color: theme.sub }}>{cond.label}</p>
            </div>

            {/* 서브 정보 */}
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>
                최고 {Math.round(high)}° / 최저 {Math.round(low)}°
              </p>
              <p style={{ fontSize: 12, color: theme.sub, marginTop: 4 }}>
                강수 {rain ?? 0}% · 습도 {humidity}%
              </p>
              <p style={{ fontSize: 12, color: theme.sub, marginTop: 2 }}>
                체감 {Math.round(feelsLike)}°
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: theme.sub, padding: "8px 0" }}>날씨를 불러올 수 없어요</p>
      )}
    </motion.div>
  );
}

// ── 경로 진행선 ────────────────────────────────────────────────────────────
function RouteArrow({ theme }) {
  return (
    <div style={{ display: "flex", alignItems: "center", paddingLeft: 28 }}>
      <div style={{ width: 2, height: 24, background: `${theme.sub}30`, borderRadius: 1 }} />
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────────────────────
export default function RoutePage({ scrollRef }) {
  const { theme } = useWeather();

  const [route, setRoute] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { from: null, via: null, to: null }; }
    catch { return { from: null, via: null, to: null }; }
  });

  const [weathers, setWeathers] = useState({ from: null, via: null, to: null });
  const [loadings, setLoadings] = useState({ from: false, via: false, to: false });
  const [searching, setSearching] = useState(null); // "from" | "via" | "to" | null

  // 위치별 날씨 fetch
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

  // 초기 로드 시 날씨 fetch
  useEffect(() => {
    ROLES.forEach(r => { if (route[r.key]) fetchWeather(r.key, route[r.key]); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 위치 선택 핸들러
  const handleSelect = (key, location) => {
    const next = { ...route, [key]: location };
    setRoute(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSearching(null);
    fetchWeather(key, location);
  };

  // 전체 새로고침
  const handleRefresh = () => {
    ROLES.forEach(r => { if (route[r.key]) fetchWeather(r.key, route[r.key]); });
  };

  const allSet = ROLES.every(r => route[r.key]);

  return (
    <div
      className={`flex-1 bg-gradient-to-b ${theme.bg} relative overflow-hidden`}
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      <div ref={scrollRef} className="absolute inset-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {/* 헤더 */}
        <div className="px-6 pt-10 pb-4">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p className="text-xs mb-1" style={{ color: theme.sub }}>경로 날씨</p>
              <h1 className="text-xl font-bold" style={{ color: theme.text }}>나의 경로</h1>
            </div>
            <button
              onClick={handleRefresh}
              style={{
                background: "rgba(0,0,0,0.06)", borderRadius: 20,
                padding: "8px 14px", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <RotateCcw size={14} style={{ color: theme.sub }} />
              <span style={{ fontSize: 12, color: theme.sub, fontWeight: 600 }}>새로고침</span>
            </button>
          </div>

          {!allSet && (
            <p className="text-xs mt-2" style={{ color: theme.sub, opacity: 0.7 }}>
              출발지·경유지·도착지를 설정하면 각 지역 날씨를 알려드려요
            </p>
          )}
        </div>

        {/* 3개 카드 + 진행선 */}
        <div className="px-4 pb-32" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {ROLES.map((role, idx) => (
            <React.Fragment key={role.key}>
              <RouteWeatherCard
                role={role}
                location={route[role.key]}
                weather={weathers[role.key]}
                loading={loadings[role.key]}
                theme={theme}
                onEdit={() => setSearching(role.key)}
              />
              {idx < ROLES.length - 1 && <RouteArrow theme={theme} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 검색 모달 */}
      {searching && (
        <SearchModal
          role={ROLES.find(r => r.key === searching)}
          theme={theme}
          onSelect={(loc) => handleSelect(searching, loc)}
          onClose={() => setSearching(null)}
        />
      )}
    </div>
  );
}
