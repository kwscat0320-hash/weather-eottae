import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, RefreshCw, Droplets, Wind, Umbrella } from "lucide-react";

const DEFAULT_LOCATION = { lat: 37.5665, lon: 126.978 };

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`,
      { headers: { "Accept-Language": "ko" } }
    );
    const data = await res.json();
    const a = data.address;
    const dong = a.neighbourhood || a.suburb || a.quarter || "";
    const gu = a.borough || a.city_district || a.district || "";
    if (dong && gu) return `${gu} ${dong}`;
    if (dong) return dong;
    if (gu) return gu;
    return a.county || a.city || a.state || "현재 위치";
  } catch {
    return "현재 위치";
  }
}

function getTheme(condition = "") {
  if (condition.includes("천둥") || condition.includes("번개"))
    return {
      img: "/characters/thunder.png",
      bg: "from-slate-900 via-indigo-950 to-slate-800",
      card: "rgba(255,255,255,0.1)", text: "#ffffff", sub: "#a5b4fc",
      bubble: "bg-white", bubbleText: "#1C283C",
      speech: ["오늘 천둥번개 진짜 무서워요...", "절대 밖에 나가지 마세요!", "저 좀 안아주세요 🥺"],
    };
  if (condition.includes("눈"))
    return {
      img: "/characters/snow.png",
      bg: "from-sky-100 via-blue-50 to-indigo-100",
      card: "rgba(255,255,255,0.6)", text: "#1e293b", sub: "#3b82f6",
      bubble: "bg-white", bubbleText: "#1C283C",
      speech: ["눈이 펑펑 와요! ❄️", "미끄러우니까 조심하세요~", "목도리 꼭 챙기기!"],
    };
  if (condition.includes("소나기"))
    return {
      img: "/characters/shower.png",
      bg: "from-slate-700 via-slate-600 to-slate-800",
      card: "rgba(255,255,255,0.1)", text: "#ffffff", sub: "#cbd5e1",
      bubble: "bg-white", bubbleText: "#1C283C",
      speech: ["갑자기 소나기 쏟아져요!", "우산 꼭 챙기세요 ☔", "저는 이미 다 젖었어요..."],
    };
  if (condition.includes("비"))
    return {
      img: "/characters/rain.png",
      bg: "from-sky-500 via-blue-400 to-sky-600",
      card: "rgba(255,255,255,0.2)", text: "#ffffff", sub: "#e0f2fe",
      bubble: "bg-white", bubbleText: "#1C283C",
      speech: ["비 오는 날도 나쁘지 않아요~ 🌧️", "우산 챙기셨나요?", "실내에서 따뜻하게 있어요!"],
    };
  if (condition.includes("흐림"))
    return {
      img: "/characters/cloudy.png",
      bg: "from-slate-400 via-slate-300 to-slate-400",
      card: "rgba(255,255,255,0.3)", text: "#0f172a", sub: "#475569",
      bubble: "bg-white", bubbleText: "#1C283C",
      speech: ["흐리고 우중충한 날이에요.", "기분도 같이 꿀꿀하네요...", "그래도 비는 안 와요!"],
    };
  if (condition.includes("구름"))
    return {
      img: "/characters/cloudy.png",
      bg: "from-slate-200 via-sky-100 to-slate-200",
      card: "rgba(255,255,255,0.5)", text: "#1e293b", sub: "#64748b",
      bubble: "bg-white", bubbleText: "#1C283C",
      speech: ["구름이 좀 있지만 괜찮아요!", "야외 활동 해볼 만해요 🐾", "가볍게 겉옷 하나 챙겨요~"],
    };
  return {
    img: "/characters/sunny.png",
    bg: "from-[#FFDF20] to-[#FDE585]",
    card: "rgba(255,254,254,0.4)", text: "#0E162B", sub: "#BA4C00",
    bubble: "bg-white", bubbleText: "#1C283C",
    speech: ["오늘 날씨 너무 좋아요! ☀️", "나들이 가기 딱 좋은 날!", "저도 같이 나가고 싶어요 🐾"],
  };
}

function gradeInfo(grade) {
  if (grade === "1") return { emoji: "😊", color: "#2563eb", label: "좋음" };
  if (grade === "2") return { emoji: "🙂", color: "#16a34a", label: "보통" };
  if (grade === "3") return { emoji: "😟", color: "#ea580c", label: "나쁨" };
  if (grade === "4") return { emoji: "😷", color: "#dc2626", label: "매우나쁨" };
  return { emoji: "😊", color: "#6b7280", label: "-" };
}

function getSpeech(theme, weather) {
  if (!weather) return theme.speech[0];
  return theme.speech[new Date().getHours() % theme.speech.length];
}

export default function WeatherApp() {
  const [coords, setCoords] = useState(DEFAULT_LOCATION);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [displayLocation, setDisplayLocation] = useState("서울");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [air, setAir] = useState(null);

  useEffect(() => { requestCurrentLocation(); }, []);

  const fetchAir = (lat, lon) => {
    fetch(`/api/air?lat=${lat}&lon=${lon}`)
      .then(r => r.json())
      .then(d => { if (d && !d.error) setAir(d); })
      .catch(() => {});
  };

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      fetchWeatherData(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
      fetchAir(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setCoords({ lat, lon });
        const name = await reverseGeocode(lat, lon);
        setDisplayLocation(name);
        fetchWeatherData(lat, lon);
        fetchAir(lat, lon);
      },
      () => {
        setCoords(DEFAULT_LOCATION);
        fetchWeatherData(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
        fetchAir(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 600000 }
    );
  };

  const isKorea = (lat, lon) => lat >= 33 && lat <= 38.9 && lon >= 124 && lon <= 132;

  const fetchWeatherData = async (lat, lon) => {
    try {
      setLoading(true);
      setError("");
      const korea = isKorea(lat, lon);
      const url = korea ? `/api/kma?lat=${lat}&lon=${lon}` : `/api/openweather?lat=${lat}&lon=${lon}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `날씨 API 오류 (${res.status})`);
      }
      const data = await res.json();
      setCurrentWeather(data.current);

      // 한국이면 중기예보(4~10일) 추가 — 단기예보 날짜는 절대 덮어쓰지 않음
      if (korea) {
        const shortForecast = data.forecast || [];
        const shortLabels = new Set(
          [...new Set(shortForecast.map(f => f.dateLabel))]
        );
        const midRes = await fetch(`/api/kma-mid?lat=${lat}&lon=${lon}`).catch(() => null);
        if (midRes?.ok) {
          const midData = await midRes.json();
          // 단기예보에 이미 있는 날짜는 중기예보에서 완전히 제외
          const midOnly = (midData.forecast || []).filter(f => !shortLabels.has(f.dateLabel));
          setForecast([...shortForecast, ...midOnly]);
        } else {
          setForecast(shortForecast);
        }
      } else {
        setForecast(data.forecast);
      }
    } catch (err) {
      setError(err.message || "알 수 없는 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  };

  const theme = useMemo(() => getTheme(currentWeather?.condition), [currentWeather]);

  const weather = useMemo(() => {
    if (!currentWeather) return null;
    return {
      condition: currentWeather.condition || "날씨 정보 없음",
      temp: Math.round(currentWeather.temp),
      feelsLike: Math.round(currentWeather.feelsLike ?? currentWeather.temp),
      high: Math.round(currentWeather.high ?? currentWeather.temp),
      low: Math.round(currentWeather.low ?? currentWeather.temp),
      rainChance: currentWeather.rainChance ?? 0,
      humidity: currentWeather.humidity ?? 0,
      wind: currentWeather.wind ?? 0,
    };
  }, [currentWeather]);

  const todayForecasts = useMemo(() => forecast.slice(0, 6), [forecast]);

  const dailyForecasts = useMemo(() => {
    const todayLabel = new Date().toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
    const grouped = {};
    forecast.forEach((item) => {
      const key = item.dateLabel;
      if (key === todayLabel) return; // 오늘 제외
      if (!grouped[key]) {
        grouped[key] = {
          date: key,
          min: item.tempMin,   // TMN 공식값 우선 (null이면 나중에 TMP로 보완)
          max: item.tempMax,   // TMX 공식값 우선
          rainChance: item.rainChance ?? 0,
          tmps: [item.temp],   // TMP 수집
        };
      } else {
        // TMN/TMX가 이미 있으면 유지, 새 슬롯에 공식값이 있으면 덮어씀
        if (item.tempMin !== null && item.tempMin !== undefined) {
          grouped[key].min = grouped[key].min === null || grouped[key].min === undefined
            ? item.tempMin
            : Math.min(grouped[key].min, item.tempMin);
        }
        if (item.tempMax !== null && item.tempMax !== undefined) {
          grouped[key].max = grouped[key].max === null || grouped[key].max === undefined
            ? item.tempMax
            : Math.max(grouped[key].max, item.tempMax);
        }
        grouped[key].rainChance = Math.max(grouped[key].rainChance, item.rainChance ?? 0);
        grouped[key].tmps.push(item.temp);
      }
    });
    return Object.values(grouped).slice(0, 5).map(({ tmps, min, max, ...rest }) => ({
      ...rest,
      min: min ?? Math.min(...tmps),  // TMN 없으면 TMP 최솟값
      max: max ?? Math.max(...tmps),  // TMX 없으면 TMP 최댓값
    }));
  }, [forecast]);

  const dateStr = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });
  const speech = getSpeech(theme, weather);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ fontFamily: "Inter, sans-serif", background: "#FFDF20" }}>
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4" />
          <p className="font-medium" style={{ color: "#BA4C00" }}>날씨 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ fontFamily: "Inter, sans-serif", background: "#fee2e2" }}>
        <div className="text-center">
          <p className="text-4xl mb-4">😿</p>
          <p className="text-slate-700 font-medium mb-4">{error}</p>
          <button onClick={() => fetchWeatherData(coords.lat, coords.lon)}
            className="px-5 py-2 bg-slate-800 text-white rounded-2xl text-sm font-semibold">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 flex justify-center" style={{ fontFamily: "Inter, sans-serif" }}>
    <div className={`w-full max-w-[393px] min-h-screen bg-gradient-to-b ${theme.bg} flex flex-col overflow-hidden`}>

      {/* 상단 바 */}
      <div className="flex items-start justify-between px-6 pt-10 pb-0">
        <div>
          <p className="text-xs font-medium" style={{ color: theme.sub }}>{dateStr}</p>
          <div className="flex items-center gap-1 mt-0.5" style={{ color: theme.sub }}>
            <MapPin size={12} />
            <span className="text-xs">{displayLocation}</span>
          </div>
        </div>
        <button onClick={requestCurrentLocation}
          className="w-9 h-9 rounded-full flex items-center justify-center mt-1"
          style={{ background: "rgba(255,254,254,0.3)" }}>
          <RefreshCw size={16} style={{ color: theme.text }} />
        </button>
      </div>

      {/* 날씨 정보 + 캐릭터 */}
      <div className="flex items-end px-6 pt-4 pb-2">
        {/* 왼쪽: 텍스트 정보 */}
        <div className="flex-1">
          <p className="text-xl font-semibold" style={{ color: theme.text }}>{weather?.condition}</p>
          <div className="font-bold leading-none mt-1" style={{ fontSize: 72, color: theme.text }}>{weather?.temp}°</div>
          <p className="text-sm mt-2" style={{ color: theme.sub }}>최고 {weather?.high}° / 최저 {weather?.low}° · 체감 {weather?.feelsLike}°</p>
        </div>

        {/* 오른쪽: 캐릭터 */}
        <div className="relative flex flex-col items-end">
          {/* 말풍선 */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl px-3 py-2 shadow-md mb-2 max-w-[140px]"
            style={{ borderBottomRightRadius: 4 }}>
            <p className="text-xs font-semibold leading-relaxed" style={{ color: "#1C283C" }}>{speech}</p>
          </motion.div>
          <motion.img key={theme.img} src={theme.img} alt="날씨 캐릭터"
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{ width: 160, height: 160, objectFit: "contain" }}
            className="drop-shadow-xl" />
        </div>
      </div>

      {/* 하단 카드들 */}
      <div className="px-4 pb-6 space-y-3 mt-2">

        {/* 요약 카드 */}
        <div className="rounded-3xl p-4" style={{ background: theme.card }}>
          <div className="grid grid-cols-3 gap-3">
            <Metric icon={<Droplets size={18} />} label="습도" value={`${weather?.humidity}%`} sub={theme.sub} text={theme.text} />
            <Metric icon={<Wind size={18} />} label="풍속" value={`${Number(weather?.wind).toFixed(1)}m/s`} sub={theme.sub} text={theme.text} />
            <Metric icon={<Umbrella size={18} />} label="강수" value={`${weather?.rainChance}%`} sub={theme.sub} text={theme.text} />
          </div>
          {air && (
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3" style={{ borderTop: `1px solid rgba(0,0,0,0.08)` }}>
              <AirCard label="미세먼지" value={air.pm10} grade={air.pm10Grade} sub={theme.sub} />
              <AirCard label="초미세먼지" value={air.pm25} grade={air.pm25Grade} sub={theme.sub} />
            </div>
          )}
        </div>

        {/* 시간대별 예보 */}
        <div className="rounded-3xl p-4" style={{ background: theme.card }}>
          <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>시간대별 예보</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {todayForecasts.map((item) => (
              <div key={`${item.dateLabel}-${item.timeLabel}`}
                className="flex-shrink-0 rounded-2xl p-2 text-center"
                style={{ width: 64, height: 75, background: "rgba(255,254,254,0.3)" }}>
                <p className="text-[11px]" style={{ color: theme.sub }}>{item.timeLabel}</p>
                <p className="font-bold text-sm mt-2" style={{ color: theme.text }}>{Math.round(item.temp)}°</p>
                <p className="text-[10px] mt-1" style={{ color: theme.sub }}>비 {item.rainChance}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* 5일 예보 */}
        <div className="rounded-3xl p-4" style={{ background: theme.card }}>
          <p className="text-xs font-semibold mb-3" style={{ color: theme.sub }}>5일 예보</p>
          <div className="space-y-3">
            {dailyForecasts.map((day) => (
              <div key={day.date} className="flex items-center justify-between">
                <p className="text-sm font-medium w-28" style={{ color: theme.text }}>{day.date}</p>
                <p className="text-xs" style={{ color: theme.sub }}>비 {day.rainChance}%</p>
                <p className="text-sm font-semibold" style={{ color: theme.text }}>{Math.round(day.min)}° / {Math.round(day.max)}°</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
    </div>
  );
}

function AirCard({ label, value, grade, sub }) {
  const { emoji, color, label: gradeLabel } = gradeInfo(grade);
  return (
    <div className="text-center">
      <p className="text-xs" style={{ color: sub }}>{label}</p>
      <div className="text-2xl mt-1">{emoji}</div>
      <p className="text-xs font-bold mt-0.5" style={{ color }}>{gradeLabel}</p>
      <p className="text-[10px] mt-0.5" style={{ color: sub }}>{value !== "-" ? `${value}㎍/㎥` : "-"}</p>
    </div>
  );
}

function Metric({ icon, label, value, sub, text }) {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-1" style={{ color: sub }}>{icon}</div>
      <p className="text-xs" style={{ color: sub }}>{label}</p>
      <p className="font-bold text-sm mt-0.5" style={{ color: text }}>{value}</p>
    </div>
  );
}