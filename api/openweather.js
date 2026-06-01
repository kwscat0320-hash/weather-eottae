import { request } from "https";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: "lat, lon 파라미터가 필요합니다." });
  }

  const key = process.env.OW_KEY;
  if (!key) {
    return res.status(500).json({ error: "OW_KEY 환경변수가 설정되지 않았습니다." });
  }

  try {
    const [currentData, forecastData] = await Promise.all([
      httpsGetJson(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric&lang=kr`
      ),
      httpsGetJson(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${key}&units=metric&lang=kr&cnt=40`
      ),
    ]);

    const current = buildCurrent(currentData);
    const forecast = buildForecast(forecastData);

    return res.status(200).json({ current, forecast });
  } catch (err) {
    console.error("[OW] error:", err.message);
    return res.status(502).json({ error: err.message });
  }
}

function httpsGetJson(urlStr) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: { "Accept": "application/json" },
    };
    const req = request(options, (r) => {
      let body = "";
      r.on("data", (chunk) => (body += chunk));
      r.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error("JSON 파싱 실패"));
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function owCondition(icon, description) {
  if (icon.startsWith("01")) return "맑음";
  if (icon.startsWith("02") || icon.startsWith("03")) return "구름많음";
  if (icon.startsWith("04")) return "흐림";
  if (icon.startsWith("09") || icon.startsWith("10")) return "비";
  if (icon.startsWith("11")) return "천둥번개";
  if (icon.startsWith("13")) return "눈";
  if (icon.startsWith("50")) return "안개";
  return description || "날씨 정보";
}

function buildCurrent(d) {
  const icon = d.weather?.[0]?.icon ?? "01d";
  const desc = d.weather?.[0]?.description ?? "";
  const temp = d.main?.temp ?? 0;
  const wind = d.wind?.speed ?? 0;
  return {
    condition: owCondition(icon, desc),
    icon,
    temp,
    feelsLike: d.main?.feels_like ?? temp,
    high: d.main?.temp_max ?? temp,
    low: d.main?.temp_min ?? temp,
    rainChance: Math.round((d.rain?.["1h"] ?? 0) > 0 ? 80 : 0),
    humidity: d.main?.humidity ?? 0,
    wind,
  };
}

function buildForecast(d) {
  return (d.list ?? []).map((item) => {
    const icon = item.weather?.[0]?.icon ?? "01d";
    const desc = item.weather?.[0]?.description ?? "";
    const date = new Date(item.dt * 1000);
    return {
      dateLabel: date.toLocaleDateString("ko-KR", {
        month: "numeric",
        day: "numeric",
        weekday: "short",
      }),
      timeLabel: date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }),
      condition: owCondition(icon, desc),
      icon,
      temp: item.main?.temp ?? 0,
      tempMin: item.main?.temp_min ?? 0,
      tempMax: item.main?.temp_max ?? 0,
      rainChance: Math.round((item.pop ?? 0) * 100),
    };
  });
}
