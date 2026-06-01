import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Bell,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  Shirt,
  Sun,
  Umbrella,
  Wind,
} from "lucide-react";

const DEFAULT_LOCATION = { lat: 37.5665, lon: 126.978, name: "서울" };

export default function WeatherApp() {
  const [coords, setCoords] = useState(DEFAULT_LOCATION);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [weatherSource, setWeatherSource] = useState("확인 중");
  const [displayLocation, setDisplayLocation] = useState(DEFAULT_LOCATION.name);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    requestCurrentLocation();
  }, []);

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      fetchWeatherData(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon, DEFAULT_LOCATION.name);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          name: "현재 위치",
        };
        setCoords(next);
        fetchWeatherData(next.lat, next.lon, next.name);
      },
      () => {
        setCoords(DEFAULT_LOCATION);
        fetchWeatherData(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon, DEFAULT_LOCATION.name);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 1000 * 60 * 10 }
    );
  };

  const isKorea = (lat, lon) =>
    lat >= 33 && lat <= 38.9 && lon >= 124 && lon <= 132;

  const fetchWeatherData = async (lat, lon, locationName) => {
    try {
      setLoading(true);
      setError("");

      const korea = isKorea(lat, lon);
      const url = korea ? `/api/kma?lat=${lat}&lon=${lon}` : `/api/openweather?lat=${lat}&lon=${lon}`;
      const source = korea ? "기상청" : "OpenWeather";

      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `날씨 API 오류 (${res.status})`);
      }

      const data = await res.json();
      setCurrentWeather(data.current);
      setForecast(data.forecast);
      setDisplayLocation(locationName);
      setWeatherSource(source);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || "알 수 없는 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  };

  const todayForecasts = useMemo(() => forecast.slice(0, 6), [forecast]);

  const dailyForecasts = useMemo(() => {
    const grouped = {};
    forecast.forEach((item) => {
      const key = item.dateLabel;
      if (!grouped[key]) {
        grouped[key] = {
          date: key,
          min: item.tempMin ?? item.temp,
          max: item.tempMax ?? item.temp,
          condition: item.condition,
          rainChance: item.rainChance ?? 0,
        };
      } else {
        grouped[key].min = Math.min(grouped[key].min, item.tempMin ?? item.temp);
        grouped[key].max = Math.max(grouped[key].max, item.tempMax ?? item.temp);
        grouped[key].rainChance = Math.max(grouped[key].rainChance, item.rainChance ?? 0);
      }
    });
    return Object.values(grouped).slice(0, 5);
  }, [forecast]);

  const weather = useMemo(() => {
    if (!currentWeather) return null;
    const rainChance = currentWeather.rainChance ?? todayForecasts[0]?.rainChance ?? 0;
    return {
      location: displayLocation,
      source: weatherSource,
      date: new Date().toLocaleDateString("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "long",
      }),
      condition: currentWeather.condition || "날씨 정보 없음",
      temp: Math.round(currentWeather.temp),
      feelsLike: Math.round(currentWeather.feelsLike ?? currentWeather.temp),
      high: Math.round(currentWeather.high ?? currentWeather.temp),
      low: Math.round(currentWeather.low ?? currentWeather.temp),
      rainChance,
      humidity: currentWeather.humidity ?? 0,
      wind: currentWeather.wind ?? 0,
    };
  }, [currentWeather, todayForecasts, displayLocation, weatherSource]);

  const outdoorScore = useMemo(() => {
    if (!weather) return 0;
    let score = 100;
    if (weather.rainChance > 50) score -= 25;
    if (weather.temp >= 30 || weather.temp <= 3) score -= 20;
    if (weather.wind > 7) score -= 10;
    return Math.max(score, 0);
  }, [weather]);

  const clothing = useMemo(() => {
    if (!weather) return "확인 중";
    if (weather.temp >= 28) return "반팔 추천";
    if (weather.temp >= 23) return "얇은 옷차림";
    if (weather.temp >= 17) return "얇은 겉옷";
    if (weather.temp >= 10) return "가디건/자켓";
    if (weather.temp >= 4) return "코트 추천";
    return "두꺼운 외투";
  }, [weather]);

  const briefingText = useMemo(() => {
    if (!weather) return "날씨 정보를 불러오는 중이에요.";
    const umbrellaText =
      weather.rainChance >= 40 ? "우산을 챙기는 게 좋아요." : "우산은 없어도 괜찮아 보여요.";
    return `오늘 ${weather.location}은 ${weather.condition}, 현재 ${weather.temp}도예요. 체감온도는 ${weather.feelsLike}도이고, 강수확률은 ${weather.rainChance}%입니다. ${umbrellaText} 옷차림은 ${clothing}이 좋아요.`;
  }, [weather, clothing]);

  if (loading) {
    return (
      <Shell>
        <div className="min-h-[680px] flex flex-col items-center justify-center text-center p-8">
          <Loader2 className="animate-spin mb-4 text-sky-500" size={36} />
          <h1 className="text-2xl font-bold">날씨어때?</h1>
          <p className="text-sm text-slate-500 mt-2">현재 위치의 날씨를 불러오는 중이에요.</p>
        </div>
      </Shell>
    );
  }

  if (error || !weather) {
    return (
      <Shell>
        <div className="min-h-[680px] flex flex-col items-center justify-center text-center p-8">
          <AlertCircle className="mb-4 text-rose-500" size={40} />
          <h1 className="text-2xl font-bold">날씨를 불러오지 못했어요</h1>
          <p className="text-sm text-slate-500 mt-3 leading-6 whitespace-pre-line">{error}</p>
          <Button
            className="rounded-2xl mt-5"
            onClick={() => fetchWeatherData(coords.lat, coords.lon, coords.name)}
          >
            다시 시도
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="rounded-[2rem] bg-white shadow-xl overflow-hidden"
      >
        <div className="bg-gradient-to-br from-sky-100 via-white to-blue-50 p-6 pb-5">
          <header className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <MapPin size={15} />
                <span>{weather.location}</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight mt-1">날씨어때?</h1>
              <p className="text-xs text-slate-400 mt-1">데이터: {weather.source}</p>
              {lastUpdated && (
                <p className="text-xs text-slate-400 mt-1">
                  업데이트{" "}
                  {lastUpdated.toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
            <button
              onClick={() => fetchWeatherData(coords.lat, coords.lon, coords.name)}
              className="h-11 w-11 rounded-full bg-white/80 shadow-sm flex items-center justify-center"
              aria-label="날씨 새로고침"
            >
              <RefreshCw size={19} />
            </button>
          </header>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">{weather.date}</p>
              <div className="flex items-start">
                <span className="text-7xl font-semibold leading-none">{weather.temp}</span>
                <span className="text-2xl font-semibold mt-2">°</span>
              </div>
              <p className="text-lg font-medium mt-2">
                {weather.condition} · 체감 {weather.feelsLike}°
              </p>
              <p className="text-sm text-slate-500 mt-1">
                최고 {weather.high}° / 최저 {weather.low}°
              </p>
            </div>
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="h-24 w-24 rounded-full bg-white shadow-md flex items-center justify-center"
            >
              <WeatherIcon condition={weather.condition} size={52} />
            </motion.div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <Card className="rounded-3xl border-0 shadow-sm bg-slate-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 font-semibold mb-3">
                <Bell size={18} />
                오늘의 날씨 요약
              </div>
              <p className="text-sm leading-6 text-slate-600">{briefingText}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <InfoCard icon={<Shirt size={20} />} title="옷차림" value={clothing} note="현재 기온 기준" />
            <InfoCard
              icon={<Umbrella size={20} />}
              title="우산"
              value={weather.rainChance >= 40 ? "챙기기" : "필요 낮음"}
              note={`강수확률 ${weather.rainChance}%`}
            />
            <InfoCard
              icon={<Navigation size={20} />}
              title="야외 활동"
              value={`${outdoorScore}점`}
              note={outdoorScore >= 80 ? "나가기 좋아요" : "상황 체크"}
            />
            <InfoCard
              icon={<Wind size={20} />}
              title="풍속"
              value={`${Number(weather.wind).toFixed(1)}m/s`}
              note={weather.wind > 7 ? "바람 강해요" : "바람 양호"}
            />
          </div>

          <Card className="rounded-3xl border-0 shadow-sm">
            <CardContent className="p-4">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <Sun size={18} /> 시간대별 예보
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {todayForecasts.length ? (
                  todayForecasts.map((item) => (
                    <HourlyCard key={`${item.dateLabel}-${item.timeLabel}`} item={item} />
                  ))
                ) : (
                  <p className="text-sm text-slate-400">시간대별 예보를 불러오는 중이에요.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 shadow-sm">
            <CardContent className="p-4">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <CloudSun size={18} /> 5일 예보
              </h2>
              <div className="space-y-3">
                {dailyForecasts.length ? (
                  dailyForecasts.map((day) => <DailyRow key={day.date} day={day} />)
                ) : (
                  <p className="text-sm text-slate-400">5일 예보를 불러오는 중이에요.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            <MiniMetric icon={<Droplets size={16} />} label="습도" value={`${weather.humidity}%`} />
            <MiniMetric
              icon={<Wind size={16} />}
              label="풍속"
              value={`${Number(weather.wind).toFixed(1)}m/s`}
            />
            <MiniMetric icon={<Umbrella size={16} />} label="강수" value={`${weather.rainChance}%`} />
          </div>
        </div>
      </motion.section>
    </Shell>
  );
}

// ── 날씨 아이콘 ───────────────────────────────────────────────────────────────

function WeatherIcon({ condition = "", size = 48 }) {
  if (condition.includes("비") || condition.includes("소나기"))
    return <CloudRain size={size} className="text-sky-500" />;
  if (condition.includes("눈"))
    return <CloudSnow size={size} className="text-blue-300" />;
  if (condition.includes("구름많음"))
    return <CloudSun size={size} className="text-slate-400" />;
  if (condition.includes("흐림"))
    return <Cloud size={size} className="text-slate-400" />;
  return <Sun size={size} className="text-yellow-400" />;
}

// ── UI 컴포넌트 ───────────────────────────────────────────────────────────────

function Card({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

function CardContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

function Button({ children, className = "", ...props }) {
  return (
    <button
      className={`px-4 py-2 text-sm font-semibold bg-slate-950 text-white hover:bg-slate-800 shadow-sm transition ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-slate-100 flex justify-center px-4 py-6 text-slate-900">
      <main className="w-full max-w-sm">{children}</main>
    </div>
  );
}

function InfoCard({ icon, title, value, note }) {
  return (
    <Card className="rounded-3xl border-0 shadow-sm bg-white">
      <CardContent className="p-4">
        <div className="h-9 w-9 rounded-2xl bg-slate-100 flex items-center justify-center mb-3 text-slate-700">
          {icon}
        </div>
        <p className="text-xs text-slate-500">{title}</p>
        <p className="font-bold mt-1">{value}</p>
        <p className="text-xs text-slate-400 mt-1">{note}</p>
      </CardContent>
    </Card>
  );
}

function HourlyCard({ item }) {
  return (
    <div className="min-w-[72px] rounded-3xl bg-slate-50 p-3 text-center">
      <p className="text-xs text-slate-500">{item.timeLabel}</p>
      <div className="flex justify-center my-1">
        <WeatherIcon condition={item.condition} size={28} />
      </div>
      <p className="font-semibold text-sm">{Math.round(item.temp)}°</p>
      <p className="text-[11px] text-slate-400 mt-1">비 {Math.round(item.rainChance || 0)}%</p>
    </div>
  );
}

function DailyRow({ day }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 flex items-center justify-center">
          <WeatherIcon condition={day.condition} size={24} />
        </div>
        <div>
          <p className="text-sm font-medium">{day.date}</p>
          <p className="text-xs text-slate-400">비 {day.rainChance}%</p>
        </div>
      </div>
      <p className="text-sm font-semibold">
        {Math.round(day.min)}° / {Math.round(day.max)}°
      </p>
    </div>
  );
}

function MiniMetric({ icon, label, value }) {
  return (
    <div className="rounded-3xl bg-white shadow-sm p-3 text-center">
      <div className="flex justify-center text-slate-500 mb-1">{icon}</div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-semibold text-sm mt-1">{value}</p>
    </div>
  );
}
