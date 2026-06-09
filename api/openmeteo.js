// GET /api/openmeteo?lat=37.5&lon=126.9
// Open-Meteo API — 무료, 키 불필요

import { request } from "https";

function httpsGetJson(urlStr) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const req = request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: { "Accept": "application/json" },
    }, (r) => {
      let body = "";
      r.on("data", (c) => (body += c));
      r.on("end", () => { try { resolve(JSON.parse(body)); } catch { reject(new Error("JSON 파싱 실패")); } });
    });
    req.on("error", reject);
    req.end();
  });
}

// PM10 수치 → 한국 등급
function pm10ToGrade(v) { return v <= 30 ? "1" : v <= 80 ? "2" : v <= 150 ? "3" : "4"; }
// PM2.5 수치 → 한국 등급
function pm25ToGrade(v) { return v <= 15 ? "1" : v <= 35 ? "2" : v <= 75 ? "3" : "4"; }

// WMO weather code → 한국어 날씨
function wmoToCondition(code) {
  if (code === 0) return "맑음";
  if (code <= 2)  return "구름많음";
  if (code === 3) return "흐림";
  if (code <= 49) return "안개";
  if (code <= 59) return "이슬비";
  if (code <= 69) return "비";
  if (code <= 79) return "눈";
  if (code <= 82) return "소나기";
  if (code <= 84) return "소나기";
  if (code <= 94) return "천둥번개";
  return "천둥번개";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "lat, lon 필요" });

  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,precipitation_probability` +
      `&hourly=temperature_2m,precipitation_probability,weather_code,apparent_temperature` +
      `&daily=temperature_2m_max,temperature_2m_min` +
      `&timezone=Asia%2FSeoul&forecast_days=2`;

    const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=pm10,pm2_5,us_aqi&domains=cams_global`;

    const [data, airData] = await Promise.all([
      httpsGetJson(weatherUrl),
      httpsGetJson(airUrl).catch(() => null),
    ]);
    const c = data.current;
    const d = data.daily;
    const h = data.hourly;

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const nowHour = now.getFullYear() + "-" +
      String(now.getMonth()+1).padStart(2,"0") + "-" +
      String(now.getDate()).padStart(2,"0") + "T" +
      String(now.getHours()).padStart(2,"0") + ":00";

    // 현재 시각 이후 6슬롯
    const startIdx = (h.time || []).findIndex(t => t >= nowHour);
    const forecast = [];
    for (let i = Math.max(0, startIdx); i < Math.min((h.time || []).length, startIdx + 24); i++) {
      const t = new Date(h.time[i]);
      forecast.push({
        timeLabel: `${String(t.getHours()).padStart(2,"0")}:00`,
        temp:       h.temperature_2m[i],
        rainChance: h.precipitation_probability[i] ?? 0,
        condition:  wmoToCondition(h.weather_code[i]),
      });
    }

    return res.status(200).json({
      condition:   wmoToCondition(c.weather_code),
      temp:        c.temperature_2m,
      feelsLike:   c.apparent_temperature,
      high:        d.temperature_2m_max?.[0] ?? c.temperature_2m,
      low:         d.temperature_2m_min?.[0] ?? c.temperature_2m,
      humidity:    c.relative_humidity_2m,
      wind:        c.wind_speed_10m,
      rainChance:  c.precipitation_probability ?? 0,
      observedAt:  `${hh}:${mm} (Open-Meteo 모델)`,
      forecast,
      air: airData?.current ? {
        pm10:      Math.round(airData.current.pm10 ?? 0),
        pm25:      Math.round(airData.current.pm2_5 ?? 0),
        pm10Grade: pm10ToGrade(airData.current.pm10 ?? 0),
        pm25Grade: pm25ToGrade(airData.current.pm2_5 ?? 0),
        source:    "Open-Meteo",
      } : null,
    });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
