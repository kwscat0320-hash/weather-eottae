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
      card: "bg-white/10", text: "text-white", sub: "text-indigo-200",
      bubble: "bg-white text-slate-800",
      speech: ["오늘 천둥번개 진짜 무서워요...", "절대 밖에 나가지 마세요!", "저 좀 안아주세요 🥺"],
    };
  if (condition.includes("눈"))
    return {
      img: "/characters/snow.png",
      bg: "from-sky-100 via-blue-50 to-indigo-100",
      card: "bg-white/60", text: "text-slate-800", sub: "text-blue-500",
      bubble: "bg-white text-slate-800",
      speech: ["눈이 펑펑 와요! ❄️", "미끄러우니까 조심하세요~", "목도리 꼭 챙기기!"],
    };
  if (condition.includes("소나기"))
    return {
      img: "/characters/shower.png",
      bg: "from-slate-700 via-slate-600 to-slate-800",
      card: "bg-white/10", text: "text-white", sub: "text-slate-300",
      bubble: "bg-white text-slate-800",
      speech: ["갑자기 소나기 쏟아져요!", "우산 꼭 챙기세요 ☔", "저는 이미 다 젖었어요..."],
    };
  if (condition.includes("비"))
    return {
      img: "/characters/rain.png",
      bg: "from-sky-500 via-blue-400 to-sky-600",
      card: "bg-white/20", text: "text-white", sub: "text-sky-100",
      bubble: "bg-white text-slate-800",
      speech: ["비 오는 날도 나쁘지 않아요~ 🌧️", "우산 챙기셨나요?", "실내에서 따뜻하게 있어요!"],
    };
  if (condition.includes("흐림"))
    return {
      img: "/characters/cloudy.png",
      bg: "from-slate-400 via-slate-300 to-slate-400",
      card: "bg-white/30", text: "text-slate-900", sub: "text-slate-600",
      bubble: "bg-white text-slate-800",
      speech: ["흐리고 우중충한 날이에요.", "기분도 같이 꿀꿀하네요...", "그래도 비는 안 와요!"],
    };
  if (condition.includes("구름"))
    return {
      img: "/characters/cloudy.png",
      bg: "from-slate-200 via-sky-100 to-slate-200",
      card: "bg-white/50", text: "text-slate-800", sub: "text-slate-500",
      bubble: "bg-white text-slate-800",
      speech: ["구름이 좀 있지만 괜찮아요!", "야외 활동 해볼 만해요 🐾", "가볍게 겉옷 하나 챙겨요~"],
    };
  return {
    img: "/characters/sunny.png",
    bg: "from-yellow-300 via-amber-200 to-orange-200",
    card: "bg-white/40", text: "text-slate-900", sub: "text-amber-700",
    bubble: "bg-white text-slate-800",
    speech: ["오늘 날씨 너무 좋아요! ☀️", "나들이 가기 딱 좋은 날!", "저도 같이 나가고 싶어요 🐾"],
  };
}

function getSpeech(theme, weather) {
  if (!weather) return theme.speech[0];
  return theme.speech[new Date().getHours() % theme.speech.length];
}

function getClothing(temp) {
  if (temp >= 28) return "반팔";
  if (temp >= 23) return "얇은 옷차림";
  if (temp >= 17) return "얇은 겉옷";
  if (temp >= 10) return "가디건·자켓";
  if (temp >= 4) return "코트";
  return "두꺼운 외투";
}

export default function WeatherApp() {
  const [coords, setCoords] = useState(DEFAULT_LOCATION);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [displayLocation, setDisplayLocation] = useState("서울");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { requestCurrentLocation(); }, []);

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      fetchWeatherData(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setCoords({ lat, lon });
        const name = await reverseGeocode(lat, lon);
        setDisplayLocation(name);
        fetchWeatherData(lat, lon);
      },
      () => {
        setCoords(DEFAULT_LOCATION);
        fetchWeatherData(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
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
      setForecast(data.forecast);
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
    const grouped = {};
    forecast.forEach((item) => {
      const key = item.dateLabel;
      if (!grouped[key]) {
        grouped[key] = { date: key, min: item.tempMin ?? item.temp, max: item.tempMax ?? item.temp, condition: item.condition, rainChance: item.rainChance ?? 0 };
      } else {
        grouped[key].min = Math.min(grouped[key].min, item.tempMin ?? item.temp);
        grouped[key].max = Math.max(grouped[key].max, item.tempMax ?? item.temp);
        grouped[key].rainChance = Math.max(grouped[key].rainChance, item.rainChance ?? 0);
      }
    });
    return Object.values(grouped).slice(0, 5);
  }, [forecast]);

  const dateStr = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });
  const speech = getSpeech(theme, weather);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-200 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-12 h-12 border-4 border-sky-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-600 font-medium">날씨 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-100 to-pink-50 flex items-center justify-center p-6">
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
    <div className="min-h-screen bg-slate-200 flex justify-center">
    <div className={`w-full max-w-[393px] min-h-screen bg-gradient-to-br ${theme.bg} flex flex-col`}>
      <div className="flex items-center justify-between px-6 pt-10 pb-2">
        <div>
          <p className={`text-xs font-medium ${theme.sub}`}>{dateStr}</p>
          <div className={`flex items-center gap-1 mt-0.5 ${theme.sub}`}>
            <MapPin size={12} />
            <span className="text-xs">{displayLocation}</span>
          </div>
        </div>
        <button onClick={requestCurrentLocation}
          className="w-9 h-9 rounded-full bg-white/30 flex items-center justify-center">
          <RefreshCw size={16} className={theme.text} />
        </button>
      </div>

      <div className="px-6 pt-4">
        <div className={`text-7xl font-bold leading-none ${theme.text}`}>{weather?.temp}°</div>
        <p className={`text-sm mt-1 ${theme.sub}`}>최고 {weather?.high}° / 최저 {weather?.low}° · 체감 {weather?.feelsLike}°</p>
        <p className={`text-xl font-semibold mt-1 ${theme.text}`}>{weather?.condition}</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-4">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className={`${theme.bubble} rounded-2xl px-5 py-3 shadow-lg max-w-[260px] text-center relative mb-2`}>
          <p className="text-sm font-semibold leading-relaxed">{speech}</p>
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-0 h-0"
            style={{ borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "12px solid white" }} />
        </motion.div>
        <motion.img key={theme.img} src={theme.img} alt="날씨 캐릭터"
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-56 h-56 object-contain drop-shadow-xl" />
      </div>

      <div className="px-4 pb-6 space-y-3">
        <div className={`${theme.card} backdrop-blur-sm rounded-3xl p-4 grid grid-cols-3 gap-3`}>
          <Metric icon={<Droplets size={18} />} label="습도" value={`${weather?.humidity}%`} theme={theme} />
          <Metric icon={<Wind size={18} />} label="풍속" value={`${Number(weather?.wind).toFixed(1)}m/s`} theme={theme} />
          <Metric icon={<Umbrella size={18} />} label="강수" value={`${weather?.rainChance}%`} theme={theme} />
        </div>

        <div className={`${theme.card} backdrop-blur-sm rounded-3xl p-4`}>
          <p className={`text-xs font-semibold mb-3 ${theme.sub}`}>시간대별 예보</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {todayForecasts.map((item) => (
              <div key={`${item.dateLabel}-${item.timeLabel}`} className="min-w-[64px] rounded-2xl bg-white/30 p-2 text-center">
                <p className={`text-[11px] ${theme.sub}`}>{item.timeLabel}</p>
                <p className={`font-bold text-sm mt-1 ${theme.text}`}>{Math.round(item.temp)}°</p>
                <p className={`text-[10px] mt-1 ${theme.sub}`}>비 {item.rainChance}%</p>
              </div>
            ))}
          </div>
        </div>

        <div className={`${theme.card} backdrop-blur-sm rounded-3xl p-4`}>
          <p className={`text-xs font-semibold mb-3 ${theme.sub}`}>5일 예보</p>
          <div className="space-y-2">
            {dailyForecasts.map((day) => (
              <div key={day.date} className="flex items-center justify-between">
                <p className={`text-sm font-medium ${theme.text} w-28`}>{day.date}</p>
                <p className={`text-xs ${theme.sub}`}>비 {day.rainChance}%</p>
                <p className={`text-sm font-semibold ${theme.text}`}>{Math.round(day.min)}° / {Math.round(day.max)}°</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

function Metric({ icon, label, value, theme }) {
  return (
    <div className="text-center">
      <div className={`flex justify-center mb-1 ${theme.sub}`}>{icon}</div>
      <p className={`text-xs ${theme.sub}`}>{label}</p>
      <p className={`font-bold text-sm ${theme.text}`}>{value}</p>
    </div>
  );
}