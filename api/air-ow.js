// GET /api/air-ow?lat=37.5&lon=126.9
// OpenWeather Air Pollution API — PM10, PM2.5, AQI

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

// OW AQI(1~5) → 한국식 등급 매핑
function aqiToGrade(aqi) {
  if (aqi === 1) return "1"; // 좋음
  if (aqi === 2) return "2"; // 보통
  if (aqi === 3) return "3"; // 나쁨
  if (aqi >= 4)  return "4"; // 매우나쁨
  return "0";
}

// PM10 수치 → 한국 등급
function pm10ToGrade(val) {
  if (val <= 30)  return "1";
  if (val <= 80)  return "2";
  if (val <= 150) return "3";
  return "4";
}

// PM2.5 수치 → 한국 등급
function pm25ToGrade(val) {
  if (val <= 15)  return "1";
  if (val <= 35)  return "2";
  if (val <= 75)  return "3";
  return "4";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "lat, lon 필요" });

  const key = process.env.OW_KEY;
  if (!key) return res.status(500).json({ error: "OW_KEY 미설정" });

  try {
    const data = await httpsGetJson(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${key}`
    );

    const item = data?.list?.[0];
    if (!item) throw new Error("대기오염 데이터 없음");

    const { pm2_5, pm10, no2, o3, co } = item.components;
    const aqi = item.main?.aqi;

    return res.status(200).json({
      pm10:      Math.round(pm10),
      pm25:      Math.round(pm2_5),
      pm10Grade: pm10ToGrade(pm10),
      pm25Grade: pm25ToGrade(pm2_5),
      aqi,
      aqiGrade:  aqiToGrade(aqi),
      no2:       Math.round(no2 * 10) / 10,
      o3:        Math.round(o3 * 10) / 10,
      source:    "OpenWeather",
    });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
