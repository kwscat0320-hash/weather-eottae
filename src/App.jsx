import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Bell,
  CloudSun,
  Droplets,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  ShieldAlert,
  Shirt,
  Sun,
  Umbrella,
  Wind,
} from "lucide-react";

// MVP 버전
// 현재는 OpenWeather API만 사용합니다.
// 기상청 API는 브라우저 CORS/인증 이슈 때문에 잠시 보류합니다.

const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;



const DEFAULT_LOCATION = {
  lat: 37.5665,
  lon: 126.978,
  name: "서울",
};

// OpenWeather Reverse Geocoding이 한국 수도권 좌표를 "서울"로 뭉뚱그려 반환하는 경우가 있어
// 화면 표시용 지역명은 먼저 좌표 기반으로 보정합니다.
const KOREA_REGION_RULES = [
  { name: "인천", minLat: 37.0, maxLat: 38.0, minLon: 124.4, maxLon: 126.85 },
  { name: "서울", minLat: 37.40, maxLat: 37.72, minLon: 126.76, maxLon: 127.20 },
  { name: "경기", minLat: 36.85, maxLat: 38.35, minLon: 126.50, maxLon: 127.90 },
  { name: "부산", minLat: 35.00, maxLat: 35.35, minLon: 128.75, maxLon: 129.35 },
  { name: "대구", minLat: 35.75, maxLat: 36.05, minLon: 128.40, maxLon: 128.80 },
  { name: "대전", minLat: 36.20, maxLat: 36.50, minLon: 127.25, maxLon: 127.55 },
  { name: "광주", minLat: 35.05, maxLat: 35.30, minLon: 126.75, maxLon: 127.05 },
  { name: "울산", minLat: 35.35, maxLat: 35.75, minLon: 129.00, maxLon: 129.50 },
  { name: "제주", minLat: 33.10, maxLat: 33.65, minLon: 126.10, maxLon: 126.95 },
];

const WEATHER_ICONS = {
  맑음: "01d",
  구름많음: "03d",
  흐림: "04d",
  비: "10d",
  "비/눈": "13d",
  눈: "13d",
  소나기: "09d",
  "날씨 정보": "03d",
};

export default function WeatherApp() {
  const [coords, setCoords] = useState(DEFAULT_LOCATION);
  const [weatherSource, setWeatherSource] = useState("확인 중");
  const [displayLocation, setDisplayLocation] = useState(DEFAULT_LOCATION.name);
  const [locationDebug, setLocationDebug] = useState("");
  const [currentWeather, setCurrentWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [airQuality, setAirQuality] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    runSelfTests();
    requestCurrentLocation();
  }, []);

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      fetchWeatherData(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          name: "현재 위치",
        };

        setCoords(nextCoords);
        fetchWeatherData(nextCoords.lat, nextCoords.lon);
      },
      () => {
        setCoords(DEFAULT_LOCATION);
        fetchWeatherData(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 1000 * 60 * 10,
      }
    );
  };

  const fetchWeatherData = async (lat, lon) => {
    try {
      setLoading(true);
      setError("");
      setLocationDebug(`위도 ${lat.toFixed(4)} · 경도 ${lon.toFixed(4)}`);
      setDisplayLocation(getDisplayRegionName(lat, lon));

      await fetchOpenWeatherData(lat, lon);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || "알 수 없는 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  };

  

  const fetchOpenWeatherData = async (lat, lon) => {
    if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY === "YOUR_API_KEY") {
      throw new Error("OpenWeather API 키를 입력해야 실제 날씨를 불러올 수 있어요.");
    }

    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=kr`;
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=kr`;
    const airUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`;

    const currentRes = await fetch(currentUrl);

    if (!currentRes.ok) {
      const errorData = await currentRes.json().catch(() => null);
      const message = errorData?.message || "현재 날씨 데이터를 불러오지 못했어요.";
      throw new Error(`OpenWeather 현재 날씨 오류: ${message}`);
    }

    const currentData = await currentRes.json();
    const locationName = await fetchOpenWeatherLocationName(lat, lon);

    const [forecastResult, airResult] = await Promise.allSettled([
      fetch(forecastUrl),
      fetch(airUrl),
    ]);

    let forecastData = [];
    let airData = null;

    if (forecastResult.status === "fulfilled" && forecastResult.value.ok) {
      const data = await forecastResult.value.json();
      forecastData = normalizeOpenWeatherForecast(data.list || []);
    }

    if (airResult.status === "fulfilled" && airResult.value.ok) {
      const data = await airResult.value.json();
      airData = data.list?.[0] || null;
    }

    setCurrentWeather(normalizeOpenWeatherCurrent(currentData));
    setForecast(forecastData);
    setAirQuality(airData);
    setDisplayLocation(locationName);
    setWeatherSource("OpenWeather");
  };

  const fetchOpenWeatherLocationName = async (lat, lon) => {
    const inferredRegion = getDisplayRegionName(lat, lon);
    if (inferredRegion !== "현재 위치") return inferredRegion;

    try {
      const geoUrl = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=5&appid=${OPENWEATHER_API_KEY}`;
      const geoRes = await fetch(geoUrl);
      if (!geoRes.ok) return coords.name;

      const geoData = await geoRes.json();
      const location = geoData.find((item) => item.country === "KR") || geoData[0];
      if (!location) return coords.name;

      const localName = location.local_names?.ko || location.name;
      const stateName = location.state;
      return stateName && stateName !== localName ? `${stateName} ${localName}` : localName;
    } catch {
      return coords.name;
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
          icon: item.icon,
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

    const pm10 = airQuality?.components?.pm10 ?? currentWeather.pm10 ?? null;
    const pm25 = airQuality?.components?.pm2_5 ?? currentWeather.pm25 ?? null;
    const rainChance = currentWeather.rainChance ?? todayForecasts[0]?.rainChance ?? 0;

    return {
      location: displayLocation || coords.name,
      source: weatherSource,
      date: new Date().toLocaleDateString("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "long",
      }),
      condition: currentWeather.condition || "날씨 정보 없음",
      icon: currentWeather.icon,
      temp: Math.round(currentWeather.temp),
      feelsLike: Math.round(currentWeather.feelsLike ?? currentWeather.temp),
      high: Math.round(currentWeather.high ?? currentWeather.temp),
      low: Math.round(currentWeather.low ?? currentWeather.temp),
      rainChance,
      humidity: currentWeather.humidity ?? 0,
      wind: currentWeather.wind ?? 0,
      pm10,
      pm25,
    };
  }, [currentWeather, airQuality, todayForecasts, coords.name, displayLocation, weatherSource]);

  const outdoorScore = useMemo(() => {
    if (!weather) return 0;

    let score = 100;
    if (weather.rainChance > 50) score -= 25;
    if ((weather.pm10 ?? 0) > 80 || (weather.pm25 ?? 0) > 35) score -= 25;
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

  const dustLabel = useMemo(() => {
    if (!weather?.pm10 && !weather?.pm25) return weather?.source === "기상청" ? "별도 연동 필요" : "확인 중";
    if ((weather.pm10 ?? 0) > 150 || (weather.pm25 ?? 0) > 75) return "매우 나쁨";
    if ((weather.pm10 ?? 0) > 80 || (weather.pm25 ?? 0) > 35) return "나쁨";
    if ((weather.pm10 ?? 0) > 30 || (weather.pm25 ?? 0) > 15) return "보통";
    return "좋음";
  }, [weather]);

  const briefingText = useMemo(() => {
    if (!weather) return "날씨 정보를 불러오는 중이에요.";

    const umbrellaText = weather.rainChance >= 40 ? "우산을 챙기는 게 좋아요." : "우산은 없어도 괜찮아 보여요.";
    const dustText =
      weather.source === "기상청"
        ? "미세먼지는 별도 API 연동이 필요해요."
        : dustLabel === "나쁨" || dustLabel === "매우 나쁨"
          ? "미세먼지도 주의해 주세요."
          : "미세먼지는 크게 걱정하지 않아도 돼요.";

    return `오늘 ${weather.location}은 ${weather.condition}, 현재 ${weather.temp}도예요. 체감온도는 ${weather.feelsLike}도이고, 강수확률은 ${weather.rainChance}%입니다. ${umbrellaText} 옷차림은 ${clothing}이 좋아요. ${dustText}`;
  }, [weather, clothing, dustLabel]);

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
          <Button className="rounded-2xl mt-5" onClick={() => fetchWeatherData(coords.lat, coords.lon)}>
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
                  업데이트 {lastUpdated.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              {locationDebug && <p className="text-[11px] text-slate-400 mt-1">{locationDebug}</p>}
            </div>
            <button
              onClick={() => fetchWeatherData(coords.lat, coords.lon)}
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
              <p className="text-lg font-medium mt-2">{weather.condition} · 체감 {weather.feelsLike}°</p>
              <p className="text-sm text-slate-500 mt-1">최고 {weather.high}° / 최저 {weather.low}°</p>
            </div>
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="h-24 w-24 rounded-full bg-white shadow-md flex items-center justify-center overflow-hidden"
            >
              {weather.icon ? (
                <img
                  src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                  alt={weather.condition}
                  className="h-24 w-24"
                />
              ) : (
                <CloudSun size={56} className="text-sky-500" />
              )}
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
            <InfoCard icon={<Navigation size={20} />} title="야외 활동" value={`${outdoorScore}점`} note={outdoorScore >= 80 ? "나가기 좋아요" : "상황 체크"} />
            <InfoCard
              icon={<ShieldAlert size={20} />}
              title="미세먼지"
              value={dustLabel}
              note={weather.source === "기상청" ? "다음 단계 연동" : `PM10 ${weather.pm10 ? Math.round(weather.pm10) : "-"}`}
            />
          </div>

          <Card className="rounded-3xl border-0 shadow-sm">
            <CardContent className="p-4">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <Sun size={18} /> 시간대별 예보
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {todayForecasts.length ? (
                  todayForecasts.map((item) => <HourlyCard key={`${item.dateLabel}-${item.timeLabel}`} item={item} />)
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
            <MiniMetric icon={<Wind size={16} />} label="풍속" value={`${Number(weather.wind).toFixed(1)}m/s`} />
            <MiniMetric icon={<Umbrella size={16} />} label="강수" value={`${weather.rainChance}%`} />
          </div>
        </div>
      </motion.section>
    </Shell>
  );
}

function isKoreaLocation(lat, lon) {
  return lat >= 33 && lat <= 39.5 && lon >= 124 && lon <= 132;
}

function getDisplayRegionName(lat, lon) {
  const matchedRegion = KOREA_REGION_RULES.find(
    (region) =>
      lat >= region.minLat &&
      lat <= region.maxLat &&
      lon >= region.minLon &&
      lon <= region.maxLon
  );

  return matchedRegion?.name || "현재 위치";
}

function buildKmaUrl(endpoint, serviceKey, baseDate, baseTime, grid, rows) {
  return (
    `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/${endpoint}` +
    `?serviceKey=${serviceKey}` +
    `&pageNo=1` +
    `&numOfRows=${rows}` +
    `&dataType=JSON` +
    `&base_date=${baseDate}` +
    `&base_time=${baseTime}` +
    `&nx=${grid.x}` +
    `&ny=${grid.y}`
  );
}

async function readKmaResponse(result, label, required = true) {
  if (result.status !== "fulfilled") {
    console.error(`${label} FETCH ERROR:`, result.reason);
    if (required) throw new Error(`${label} 호출에 실패했어요. 브라우저 CORS 차단 또는 네트워크 문제 가능성이 높아요.`);
    return null;
  }

  const responseText = await result.value.text().catch(() => "");
  console.log(`${label} HTTP STATUS:`, result.value.status, result.value.statusText);
  console.log(`${label} RAW RESPONSE:`, responseText);

  if (!result.value.ok) {
    if (required) throw new Error(`${label} HTTP ${result.value.status}: ${responseText || result.value.statusText}`);
    return null;
  }

  if (!responseText) {
    if (required) throw new Error(`${label} 응답이 비어 있어요.`);
    return null;
  }

  let data = null;

  try {
    data = JSON.parse(responseText);
  } catch {
    if (required) throw new Error(`${label} 응답이 JSON 형식이 아니에요.`);
    return null;
  }

  const code = data?.response?.header?.resultCode;
  const message = data?.response?.header?.resultMsg;

  if (code && code !== "00") {
    if (required) throw new Error(`${label} 오류: ${message || code}`);
    return null;
  }

  return data;
}

function normalizeKmaItems(items) {
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

function buildKmaCurrentWeather(villageItems, ultraNowItems, ultraForecastItems, lat, lon, grid) {
  const nowMap = itemsToCategoryMap(ultraNowItems);
  const firstForecast = pickFirstForecastGroup(villageItems, ultraForecastItems);
  const today = formatDateYYYYMMDD(new Date());

  const todayVillage = villageItems.filter((item) => item.fcstDate === today);
  const tmx = findCategoryValue(todayVillage, "TMX");
  const tmn = findCategoryValue(todayVillage, "TMN");

  const temp = Number(nowMap.T1H ?? firstForecast.TMP ?? firstForecast.T1H ?? 0);
  const humidity = Number(nowMap.REH ?? firstForecast.REH ?? 0);
  const wind = Number(nowMap.WSD ?? firstForecast.WSD ?? 0);
  const sky = firstForecast.SKY;
  const pty = firstForecast.PTY ?? nowMap.PTY;
  const condition = getKmaCondition(sky, pty);

  return {
    location: "현재 위치",
    lat,
    lon,
    grid,
    condition,
    icon: WEATHER_ICONS[condition] || "03d",
    temp,
    feelsLike: calcFeelsLike(temp, wind),
    high: Number(tmx ?? firstForecast.TMP ?? temp),
    low: Number(tmn ?? firstForecast.TMP ?? temp),
    rainChance: Number(firstForecast.POP ?? 0),
    humidity,
    wind,
  };
}

function buildKmaHourlyForecast(villageItems, ultraForecastItems) {
  const baseItems = ultraForecastItems.length ? ultraForecastItems : villageItems;
  const grouped = groupForecastItems(baseItems).slice(0, 8);

  return grouped.map((group) => {
    const condition = getKmaCondition(group.SKY, group.PTY);
    const date = parseKmaDateTime(group.fcstDate, group.fcstTime);

    return {
      dateLabel: date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" }),
      timeLabel: formatKmaTime(group.fcstTime),
      condition,
      icon: WEATHER_ICONS[condition] || "03d",
      temp: Number(group.TMP ?? group.T1H ?? 0),
      tempMin: Number(group.TMP ?? group.T1H ?? 0),
      tempMax: Number(group.TMP ?? group.T1H ?? 0),
      rainChance: Number(group.POP ?? 0),
    };
  });
}

function buildKmaDailyForecast(villageItems) {
  const grouped = groupForecastItems(villageItems);

  return grouped.map((group) => {
    const condition = getKmaCondition(group.SKY, group.PTY);
    const date = parseKmaDateTime(group.fcstDate, group.fcstTime);

    return {
      dateLabel: date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" }),
      timeLabel: formatKmaTime(group.fcstTime),
      condition,
      icon: WEATHER_ICONS[condition] || "03d",
      temp: Number(group.TMP ?? group.T1H ?? 0),
      tempMin: Number(group.TMN ?? group.TMP ?? group.T1H ?? 0),
      tempMax: Number(group.TMX ?? group.TMP ?? group.T1H ?? 0),
      rainChance: Number(group.POP ?? 0),
    };
  });
}

function normalizeOpenWeatherCurrent(data) {
  return {
    condition: data.weather?.[0]?.description || "날씨 정보 없음",
    icon: data.weather?.[0]?.icon,
    temp: data.main.temp,
    feelsLike: data.main.feels_like,
    high: data.main.temp_max,
    low: data.main.temp_min,
    rainChance: 0,
    humidity: data.main.humidity,
    wind: data.wind.speed,
  };
}

function normalizeOpenWeatherForecast(list) {
  return list.map((item) => {
    const date = new Date(item.dt * 1000);

    return {
      dateLabel: date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" }),
      timeLabel: date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      condition: item.weather?.[0]?.description || "날씨",
      icon: item.weather?.[0]?.icon,
      temp: item.main.temp,
      tempMin: item.main.temp_min,
      tempMax: item.main.temp_max,
      rainChance: Math.round((item.pop || 0) * 100),
    };
  });
}

function itemsToCategoryMap(items) {
  return items.reduce((acc, item) => {
    acc[item.category] = item.obsrValue ?? item.fcstValue;
    return acc;
  }, {});
}

function groupForecastItems(items) {
  const groups = {};

  items.forEach((item) => {
    const key = `${item.fcstDate}-${item.fcstTime}`;
    if (!groups[key]) {
      groups[key] = {
        fcstDate: item.fcstDate,
        fcstTime: item.fcstTime,
      };
    }
    groups[key][item.category] = item.fcstValue;
  });

  return Object.values(groups).sort((a, b) => `${a.fcstDate}${a.fcstTime}`.localeCompare(`${b.fcstDate}${b.fcstTime}`));
}

function pickFirstForecastGroup(villageItems, ultraForecastItems) {
  const ultraGroups = groupForecastItems(ultraForecastItems);
  if (ultraGroups.length) return ultraGroups[0];

  const villageGroups = groupForecastItems(villageItems);
  return villageGroups[0] || {};
}

function findCategoryValue(items, category) {
  return items.find((item) => item.category === category)?.fcstValue;
}

function getKmaCondition(sky, pty) {
  const ptyCode = String(pty ?? "0");
  const skyCode = String(sky ?? "1");

  if (ptyCode === "1") return "비";
  if (ptyCode === "2") return "비/눈";
  if (ptyCode === "3") return "눈";
  if (ptyCode === "4") return "소나기";

  if (skyCode === "1") return "맑음";
  if (skyCode === "3") return "구름많음";
  if (skyCode === "4") return "흐림";
  return "날씨 정보";
}

function calcFeelsLike(temp, wind) {
  if (temp <= 10 && wind >= 1.3) {
    return temp - Math.min(5, wind * 0.5);
  }
  return temp;
}

function getKmaBaseDateTime() {
  const now = new Date();
  const ultra = new Date(now);

  if (ultra.getMinutes() < 45) ultra.setHours(ultra.getHours() - 1);

  const village = new Date(now);
  const hour = village.getHours();
  const minute = village.getMinutes();
  const currentHHMM = hour * 100 + minute;
  const baseTimes = [2300, 2000, 1700, 1400, 1100, 800, 500, 200];
  let selected = baseTimes.find((time) => currentHHMM >= time + 10);

  if (!selected) {
    village.setDate(village.getDate() - 1);
    selected = 2300;
  }

  return {
    date: formatDateYYYYMMDD(village),
    ultraDate: formatDateYYYYMMDD(ultra),
    ultraTime: `${String(ultra.getHours()).padStart(2, "0")}00`,
    vilageTime: String(selected).padStart(4, "0"),
  };
}

function parseKmaDateTime(date, time) {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(4, 6)) - 1;
  const d = Number(date.slice(6, 8));
  const h = Number(time.slice(0, 2));
  const min = Number(time.slice(2, 4));
  return new Date(y, m, d, h, min);
}

function formatKmaTime(time) {
  return `${time.slice(0, 2)}:${time.slice(2, 4)}`;
}

function formatDateYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function dfsXyConv(code, v1, v2) {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;

  const DEGRAD = Math.PI / 180.0;
  const RADDEG = 180.0 / Math.PI;

  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);

  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;

  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  if (code === "toXY") {
    let ra = Math.tan(Math.PI * 0.25 + v1 * DEGRAD * 0.5);
    ra = (re * sf) / Math.pow(ra, sn);
    let theta = v2 * DEGRAD - olon;
    if (theta > Math.PI) theta -= 2.0 * Math.PI;
    if (theta < -Math.PI) theta += 2.0 * Math.PI;
    theta *= sn;

    return {
      x: Math.floor(ra * Math.sin(theta) + XO + 0.5),
      y: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
    };
  }

  let xn = v1 - XO;
  let yn = ro - v2 + YO;
  let ra = Math.sqrt(xn * xn + yn * yn);
  if (sn < 0.0) ra = -ra;
  let alat = Math.pow((re * sf) / ra, 1.0 / sn);
  alat = 2.0 * Math.atan(alat) - Math.PI * 0.5;

  let theta = 0.0;
  if (Math.abs(xn) <= 0.0) {
    theta = 0.0;
  } else {
    if (Math.abs(yn) <= 0.0) {
      theta = Math.PI * 0.5;
      if (xn < 0.0) theta = -theta;
    } else {
      theta = Math.atan2(xn, yn);
    }
  }
  const alon = theta / sn + olon;

  return {
    lat: alat * RADDEG,
    lon: alon * RADDEG,
  };
}

function runSelfTests() {
  const seoul = dfsXyConv("toXY", 37.5665, 126.978);
  console.assert(Number.isFinite(seoul.x) && Number.isFinite(seoul.y), "DFS grid conversion should return finite x/y");
  console.assert(isKoreaLocation(37.5665, 126.978) === true, "Seoul should be detected as Korea");
  console.assert(isKoreaLocation(40.7128, -74.006) === false, "New York should not be detected as Korea");
  console.assert(getKmaCondition("1", "0") === "맑음", "KMA SKY=1, PTY=0 should be 맑음");
  console.assert(getKmaCondition("4", "1") === "비", "KMA PTY=1 should be 비");
}

function Card({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

function CardContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

function Button({ children, className = "", variant = "default", ...props }) {
  const baseClass =
    variant === "outline"
      ? "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
      : "bg-slate-950 text-white hover:bg-slate-800";

  return (
    <button
      className={`px-4 py-2 text-sm font-semibold shadow-sm transition ${baseClass} ${className}`}
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
      <img
        src={`https://openweathermap.org/img/wn/${item.icon}@2x.png`}
        alt={item.condition || "날씨"}
        className="h-11 w-11 mx-auto"
      />
      <p className="font-semibold text-sm">{Math.round(item.temp)}°</p>
      <p className="text-[11px] text-slate-400 mt-1">비 {Math.round(item.rainChance || 0)}%</p>
    </div>
  );
}

function DailyRow({ day }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <div className="flex items-center gap-2">
        <img src={`https://openweathermap.org/img/wn/${day.icon}@2x.png`} alt={day.condition} className="h-9 w-9" />
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
