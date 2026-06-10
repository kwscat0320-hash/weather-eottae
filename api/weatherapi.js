import { request } from "https";

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    request(url, { headers: { "User-Agent": "weather-eottae/1.0" } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error("JSON parse error: " + data.slice(0, 200))); }
      });
    }).on("error", reject).end();
  });
}

// WeatherAPI 날씨 코드 → 한국어
function wapiCondition(code, isDay) {
  const map = {
    1000: "맑음", 1003: "구름 조금", 1006: "구름 많음", 1009: "흐림",
    1030: "안개", 1063: "가끔 비", 1066: "가끔 눈", 1069: "가끔 진눈깨비",
    1072: "가끔 어는 비", 1087: "뇌우", 1114: "눈보라", 1117: "강한 눈보라",
    1135: "안개", 1147: "어는 안개", 1150: "이슬비", 1153: "이슬비",
    1168: "어는 이슬비", 1171: "강한 어는 이슬비", 1180: "가벼운 비",
    1183: "비", 1186: "가끔 비", 1189: "비", 1192: "강한 비",
    1195: "폭우", 1198: "가벼운 어는 비", 1201: "어는 비",
    1204: "가벼운 진눈깨비", 1207: "진눈깨비", 1210: "가벼운 눈",
    1213: "눈", 1216: "눈", 1219: "눈", 1222: "강한 눈", 1225: "폭설",
    1237: "우박", 1240: "가벼운 소나기", 1243: "소나기", 1246: "강한 소나기",
    1249: "진눈깨비 소나기", 1252: "강한 진눈깨비", 1255: "가벼운 눈소나기",
    1258: "강한 눈소나기", 1261: "가벼운 우박", 1264: "강한 우박",
    1273: "가끔 뇌우", 1276: "뇌우", 1279: "눈 뇌우", 1282: "강한 눈 뇌우",
  };
  return map[code] || "알 수 없음";
}

// 시간 포맷 "06:15 AM" → "06:15"
function fmtAmPm(str) {
  if (!str) return null;
  const [time, ampm] = str.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "lat, lon 파라미터가 필요합니다." });

  const key = process.env.WAPI_KEY;
  if (!key) return res.status(500).json({ error: "WAPI_KEY 환경변수가 설정되지 않았습니다." });

  try {
    // forecast?days=7 하면 current + 7일 예보 + 시간별 모두 포함
    const data = await httpsGetJson(
      `https://api.weatherapi.com/v1/forecast.json?key=${key}&q=${lat},${lon}&days=7&lang=ko&aqi=yes&alerts=no`
    );

    if (data.error) return res.status(400).json({ error: data.error.message });

    const c = data.current;
    const todayAstro = data.forecast?.forecastday?.[0]?.astro;

    // ── 현재 날씨 ──────────────────────────────────────────────────────────
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");

    const current = {
      condition:   wapiCondition(c.condition?.code, c.is_day),
      temp:        c.temp_c,
      feelsLike:   c.feelslike_c,
      high:        data.forecast?.forecastday?.[0]?.day?.maxtemp_c ?? c.temp_c,
      low:         data.forecast?.forecastday?.[0]?.day?.mintemp_c ?? c.temp_c,
      humidity:    c.humidity,
      wind:        Math.round((c.wind_kph / 3.6) * 10) / 10,  // kph → m/s
      rainChance:  data.forecast?.forecastday?.[0]?.day?.daily_chance_of_rain ?? 0,
      observedAt:  `${hh}:${mm} (WeatherAPI)`,
      // 추가 필드
      windDir:     c.wind_dir,
      windGust:    Math.round((c.gust_kph / 3.6) * 10) / 10,
      cloudCover:  c.cloud,
      visibility:  c.vis_km * 1000,  // km → m (Open-Meteo와 단위 맞춤)
      uvIndex:     c.uv,
      pressureMb:  c.pressure_mb,
      dewPoint:    c.dewpoint_c ?? null,
      sunrise:     fmtAmPm(todayAstro?.sunrise),
      sunset:      fmtAmPm(todayAstro?.sunset),
      isDay:       c.is_day === 1,
    };

    // ── 대기질 ─────────────────────────────────────────────────────────────
    const aq = c.air_quality;
    let air = null;
    if (aq) {
      const pm25 = Math.round(aq["pm2_5"] ?? 0);
      const pm10 = Math.round(aq["pm10"] ?? 0);
      const pm25Grade = pm25 <= 15 ? 1 : pm25 <= 35 ? 2 : pm25 <= 75 ? 3 : 4;
      const pm10Grade = pm10 <= 30 ? 1 : pm10 <= 80 ? 2 : pm10 <= 150 ? 3 : 4;
      air = { pm25, pm10, pm25Grade, pm10Grade };
    }

    // ── 시간별 예보 (오늘+내일 48h에서 앞 24개) ────────────────────────────
    const allHours = (data.forecast?.forecastday || []).flatMap(fd =>
      (fd.hour || []).map(h => {
        const d = new Date(h.time);
        return {
          isoTime:       h.time,
          dateLabel:     d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" }),
          timeLabel:     `${String(d.getHours()).padStart(2, "0")}:00`,
          temp:          h.temp_c,
          feelsLike:     h.feelslike_c,
          rainChance:    h.chance_of_rain,
          condition:     wapiCondition(h.condition?.code, h.is_day),
          humidity:      h.humidity,
          wind:          Math.round((h.wind_kph / 3.6) * 10) / 10,
          precipitation: h.precip_mm ?? 0,
          tempMin:       h.temp_c,
          tempMax:       h.temp_c,
        };
      })
    );

    // 현재 시각 이후 24개
    const nowMs = Date.now();
    const forecast = allHours.filter(h => new Date(h.isoTime).getTime() >= nowMs - 3600000).slice(0, 24);

    // ── 일별 예보 (오늘 제외 최대 6일) ────────────────────────────────────
    const todayDate = new Date().toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
    const daily = (data.forecast?.forecastday || [])
      .map(fd => {
        const d = new Date(fd.date + "T00:00:00");
        const dateLabel = d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
        return {
          dateLabel,
          date: dateLabel,
          tempMax:    fd.day?.maxtemp_c,
          tempMin:    fd.day?.mintemp_c,
          max:        fd.day?.maxtemp_c,
          min:        fd.day?.mintemp_c,
          rainChance: fd.day?.daily_chance_of_rain ?? 0,
          condition:  wapiCondition(fd.day?.condition?.code, 1),
          sunrise:    fmtAmPm(fd.astro?.sunrise),
          sunset:     fmtAmPm(fd.astro?.sunset),
          uvMax:      fd.day?.uv,
        };
      })
      .filter(d => d.dateLabel !== todayDate)
      .slice(0, 6);

    return res.status(200).json({ current, forecast, daily, air });
  } catch (err) {
    console.error("[weatherapi]", err);
    return res.status(500).json({ error: err.message });
  }
}
