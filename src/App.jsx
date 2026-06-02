import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, RefreshCw, Droplets, Wind, Umbrella, ChevronDown, ChevronUp } from "lucide-react";

const DEFAULT_LOCATION = { lat: 37.5665, lon: 126.978, name: "?쒖슱" };

// ?? ?좎뵪 ??罹먮┃???뚮쭏 留ㅽ븨 ?????????????????????????????????????????????????

function getTheme(condition = "") {
  if (condition.includes("泥쒕뫁") || condition.includes("踰덇컻"))
    return {
      img: "/characters/thunder.png",
      bg: "from-slate-900 via-indigo-950 to-slate-800",
      card: "bg-white/10",
      text: "text-white",
      sub: "text-indigo-200",
      bubble: "bg-white text-slate-800",
      speech: ["?ㅻ뒛 泥쒕뫁踰덇컻 吏꾩쭨 臾댁꽌?뚯슂...", "?덈? 諛뽰뿉 ?섍?吏 留덉꽭??", "? 醫 ?덉븘二쇱꽭????"],
    };
  if (condition.includes("??))
    return {
      img: "/characters/snow.png",
      bg: "from-sky-100 via-blue-50 to-indigo-100",
      card: "bg-white/60",
      text: "text-slate-800",
      sub: "text-blue-500",
      bubble: "bg-white text-slate-800",
      speech: ["?덉씠 ?묓럱 ??? ?꾬툘", "誘몃걚?ъ슦?덇퉴 議곗떖?섏꽭??", "紐⑸룄由?瑗?梨숆린湲?"],
    };
  if (condition.includes("?뚮굹湲?))
    return {
      img: "/characters/shower.png",
      bg: "from-slate-700 via-slate-600 to-slate-800",
      card: "bg-white/10",
      text: "text-white",
      sub: "text-slate-300",
      bubble: "bg-white text-slate-800",
      speech: ["媛묒옄湲??뚮굹湲??잛븘?몄슂!", "?곗궛 瑗?梨숆린?몄슂 ??, "????대? ???뽰뿀?댁슂..."],
    };
  if (condition.includes("鍮?))
    return {
      img: "/characters/rain.png",
      bg: "from-sky-500 via-blue-400 to-sky-600",
      card: "bg-white/20",
      text: "text-white",
      sub: "text-sky-100",
      bubble: "bg-white text-slate-800",
      speech: ["鍮??ㅻ뒗 ?좊룄 ?섏걯吏 ?딆븘?? ?뙢截?, "?곗궛 梨숆린?⑤굹??", "?ㅻ궡?먯꽌 ?곕쑜?섍쾶 ?덉뼱??"],
    };
  if (condition.includes("?먮┝"))
    return {
      img: "/characters/cloudy.png",
      bg: "from-slate-400 via-slate-300 to-slate-400",
      card: "bg-white/30",
      text: "text-slate-900",
      sub: "text-slate-600",
      bubble: "bg-white text-slate-800",
      speech: ["?먮━怨??곗쨷異⑺븳 ?좎씠?먯슂.", "湲곕텇??媛숈씠 轅轅?섎꽕??..", "洹몃옒??鍮꾨뒗 ?????"],
    };
  if (condition.includes("援щ쫫"))
    return {
      img: "/characters/cloudy.png",
      bg: "from-slate-200 via-sky-100 to-slate-200",
      card: "bg-white/50",
      text: "text-slate-800",
      sub: "text-slate-500",
      bubble: "bg-white text-slate-800",
      speech: ["援щ쫫??醫 ?덉?留?愿쒖갖?꾩슂!", "?쇱쇅 ?쒕룞 ?대낵 留뚰빐???맽", "媛蹂띻쾶 寃됱샆 ?섎굹 梨숆꺼??"],
    };
  // 留묒쓬 default
  return {
    img: "/characters/sunny.png",
    bg: "from-yellow-300 via-amber-200 to-orange-200",
    card: "bg-white/40",
    text: "text-slate-900",
    sub: "text-amber-700",
    bubble: "bg-white text-slate-800",
    speech: ["?ㅻ뒛 ?좎뵪 ?덈Т 醫뗭븘?? ?截?, "?섎뱾??媛湲???醫뗭? ??", "???媛숈씠 ?섍?怨??띠뼱???맽"],
  };
}

function getSpeech(theme, weather) {
  if (!weather) return theme.speech[0];
  const idx = new Date().getHours() % theme.speech.length;
  return theme.speech[idx];
}

function getClothing(temp) {
  if (temp >= 28) return "諛섑뙏";
  if (temp >= 23) return "?뉗? ?룹감由?;
  if (temp >= 17) return "?뉗? 寃됱샆";
  if (temp >= 10) return "媛?붽굔쨌?먯폆";
  if (temp >= 4) return "肄뷀듃";
  return "?먭볼???명닾";
}

// ?? 硫붿씤 而댄룷?뚰듃 ?????????????????????????????????????????????????????????????

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`,
      { headers: { "Accept-Language": "ko" } }
    );
    const data = await res.json();
    const a = data.address;
    // 동 > 읍/면 > 구 > 시 순으로 가장 세밀한 단위 반환
    return a.neighbourhood || a.suburb || a.quarter || a.city_district || a.district || a.county || a.city || a.state || "현재 위치";
  } catch {
    return "현재 위치";
  }
}

export default function WeatherApp() {
  const [coords, setCoords] = useState(DEFAULT_LOCATION);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [displayLocation, setDisplayLocation] = useState("서울");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDetail, setShowDetail] = useState(false);

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
        const locationName = await reverseGeocode(lat, lon);
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
        throw new Error(body.error || `?좎뵪 API ?ㅻ쪟 (${res.status})`);
      }
      const data = await res.json();
      setCurrentWeather(data.current);
      setForecast(data.forecast);
          } catch (err) {
      setError(err.message || "?????녿뒗 ?ㅻ쪟媛 諛쒖깮?덉뼱??");
    } finally {
      setLoading(false);
    }
  };

  const theme = useMemo(() => getTheme(currentWeather?.condition), [currentWeather]);

  const weather = useMemo(() => {
    if (!currentWeather) return null;
    return {
      condition: currentWeather.condition || "?좎뵪 ?뺣낫 ?놁쓬",
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

  // ?? 濡쒕뵫 ????????????????????????????????????????????????????????????????????

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-200 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-12 h-12 border-4 border-sky-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-600 font-medium">?좎뵪 遺덈윭?ㅻ뒗 以?..</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-100 to-pink-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-4xl mb-4">?샒</p>
          <p className="text-slate-700 font-medium mb-4">{error}</p>
          <button onClick={() => fetchWeatherData(coords.lat, coords.lon)}
            className="px-5 py-2 bg-slate-800 text-white rounded-2xl text-sm font-semibold">
            ?ㅼ떆 ?쒕룄
          </button>
        </div>
      </div>
    );
  }

  // ?? 硫붿씤 ?붾㈃ ????????????????????????????????????????????????????????????????

  return (
    <div className="min-h-screen bg-slate-200 flex justify-center">
    <div className={`w-full max-w-[393px] min-h-screen bg-gradient-to-br ${theme.bg} flex flex-col`}>
      {/* ?곷떒 諛?*/}
      <div className="flex items-center justify-between px-6 pt-10 pb-2">
        <div>
          <p className={`text-xs font-medium ${theme.sub}`}>{dateStr}</p>
          <div className={`flex items-center gap-1 mt-0.5 ${theme.sub}`}>
            <MapPin size={12} />
            <span className="text-xs">{displayLocation} 쨌 {weatherSource}</span>
          </div>
        </div>
        <button onClick={() => fetchWeatherData(coords.lat, coords.lon)}
          className="w-9 h-9 rounded-full bg-white/30 flex items-center justify-center">
          <RefreshCw size={16} className={theme.text} />
        </button>
      </div>

      {/* ?⑤룄 + ?좎뵪 ?곹깭 */}
      <div className="px-6 pt-4">
        <div className={`text-7xl font-bold leading-none ${theme.text}`}>
          {weather?.temp}째
        </div>
        <p className={`text-xl font-semibold mt-1 ${theme.text}`}>{weather?.condition}</p>
        <p className={`text-sm mt-1 ${theme.sub}`}>
          理쒓퀬 {weather?.high}째 / 理쒖? {weather?.low}째 쨌 泥닿컧 {weather?.feelsLike}째
        </p>
      </div>

      {/* 罹먮┃??+ 留먰뭾??*/}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 relative">
        {/* 留먰뭾??*/}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`${theme.bubble} rounded-2xl px-5 py-3 shadow-lg max-w-[260px] text-center relative mb-2`}
        >
          <p className="text-sm font-semibold leading-relaxed">{speech}</p>
          {/* 留먰뭾??瑗щ━ */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-0 h-0"
            style={{ borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "12px solid white" }} />
        </motion.div>

        {/* 罹먮┃???대?吏 */}
        <motion.img
          key={theme.img}
          src={theme.img}
          alt="?좎뵪 罹먮┃??
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-56 h-56 object-contain drop-shadow-xl"
        />
      </div>

      {/* ?섎떒 ?붿빟 移대뱶 */}
      <div className="px-4 pb-6 space-y-3">
        {/* ?듭떖 吏??*/}
        <div className={`${theme.card} backdrop-blur-sm rounded-3xl p-4 grid grid-cols-3 gap-3`}>
          <Metric icon={<Droplets size={18} />} label="?듬룄" value={`${weather?.humidity}%`} theme={theme} />
          <Metric icon={<Wind size={18} />} label="?띿냽" value={`${Number(weather?.wind).toFixed(1)}m/s`} theme={theme} />
          <Metric icon={<Umbrella size={18} />} label="媛뺤닔" value={`${weather?.rainChance}%`} theme={theme} />
        </div>

        {/* ?곸꽭 ?덈낫 ?좉? */}
        <button
          onClick={() => setShowDetail((v) => !v)}
          className={`w-full ${theme.card} backdrop-blur-sm rounded-3xl px-4 py-3 flex items-center justify-between ${theme.text} font-semibold text-sm`}
        >
          <span>?쒓컙?蹂?쨌 二쇨컙 ?덈낫</span>
          {showDetail ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        <AnimatePresence>
          {showDetail && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden space-y-3"
            >
              {/* ?쒓컙?蹂?*/}
              <div className={`${theme.card} backdrop-blur-sm rounded-3xl p-4`}>
                <p className={`text-xs font-semibold mb-3 ${theme.sub}`}>?쒓컙?蹂??덈낫</p>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {todayForecasts.map((item) => (
                    <div key={`${item.dateLabel}-${item.timeLabel}`}
                      className="min-w-[64px] rounded-2xl bg-white/30 p-2 text-center">
                      <p className={`text-[11px] ${theme.sub}`}>{item.timeLabel}</p>
                      <p className={`font-bold text-sm mt-1 ${theme.text}`}>{Math.round(item.temp)}째</p>
                      <p className={`text-[10px] mt-1 ${theme.sub}`}>鍮?{item.rainChance}%</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 二쇨컙 ?덈낫 */}
              <div className={`${theme.card} backdrop-blur-sm rounded-3xl p-4`}>
                <p className={`text-xs font-semibold mb-3 ${theme.sub}`}>5???덈낫</p>
                <div className="space-y-2">
                  {dailyForecasts.map((day) => (
                    <div key={day.date} className="flex items-center justify-between">
                      <p className={`text-sm font-medium ${theme.text} w-28`}>{day.date}</p>
                      <p className={`text-xs ${theme.sub}`}>鍮?{day.rainChance}%</p>
                      <p className={`text-sm font-semibold ${theme.text}`}>{Math.round(day.min)}째 / {Math.round(day.max)}째</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ?룹감由?*/}
              <div className={`${theme.card} backdrop-blur-sm rounded-3xl p-4 text-center`}>
                <p className={`text-xs ${theme.sub} mb-1`}>?ㅻ뒛 ?룹감由?異붿쿇</p>
                <p className={`text-lg font-bold ${theme.text}`}>{getClothing(weather?.temp)}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
