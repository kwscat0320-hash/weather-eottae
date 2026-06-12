// ECMWF IFS via Open-Meteo (replaces OpenWeather)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "lat, lon 필요" });

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&models=ecmwf_ifs04` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation` +
      `&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
      `&timezone=Asia%2FSeoul&forecast_days=6`;

    const data = await fetch(url).then(r => r.json());
    if (data.error) throw new Error(data.reason || "ECMWF 응답 오류");

    return res.status(200).json({
      current:  buildCurrent(data),
      forecast: buildForecast(data),
    });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}

function wmoToCondition(code) {
  if (code === 0)  return "맑음";
  if (code <= 2)   return "구름많음";
  if (code === 3)  return "흐림";
  if (code <= 49)  return "안개";
  if (code <= 59)  return "이슬비";
  if (code <= 69)  return "비";
  if (code <= 79)  return "눈";
  if (code <= 82)  return "소나기";
  if (code <= 86)  return "눈소나기";
  return "뇌우";
}

function buildCurrent(data) {
  const c = data.current;
  const d = data.daily;
  const nowHour = data.hourly?.time?.findIndex(t => t >= c.time) ?? 0;
  return {
    condition:  wmoToCondition(c.weather_code),
    temp:       c.temperature_2m,
    feelsLike:  c.apparent_temperature,
    high:       d?.temperature_2m_max?.[0] ?? c.temperature_2m,
    low:        d?.temperature_2m_min?.[0] ?? c.temperature_2m,
    rainChance: data.hourly?.precipitation_probability?.[nowHour] ?? 0,
    humidity:   c.relative_humidity_2m,
    wind:       c.wind_speed_10m,
    observedAt: `${(c.time || "").slice(11, 16)} (ECMWF IFS)`,
  };
}

function buildForecast(data) {
  const h = data.hourly;
  const d = data.daily;

  const dailyMap = {};
  (d?.time || []).forEach((date, i) => {
    dailyMap[date] = {
      tempMax:    d.temperature_2m_max?.[i] ?? null,
      tempMin:    d.temperature_2m_min?.[i] ?? null,
      rainChance: d.precipitation_probability_max?.[i] ?? 0,
    };
  });

  return (h?.time || []).slice(0, 40).map((t, i) => {
    const dateStr = t.slice(0, 10);
    const day = dailyMap[dateStr] || {};
    const date = new Date(t + ":00+09:00");
    return {
      dateLabel:   date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" }),
      timeLabel:   t.slice(11, 16),
      condition:   wmoToCondition(h.weather_code?.[i]),
      temp:        h.temperature_2m?.[i]         ?? 0,
      tempMin:     day.tempMin                   ?? h.temperature_2m?.[i] ?? 0,
      tempMax:     day.tempMax                   ?? h.temperature_2m?.[i] ?? 0,
      rainChance:  h.precipitation_probability?.[i] ?? 0,
      humidity:    h.relative_humidity_2m?.[i]   ?? 0,
      wind:        h.wind_speed_10m?.[i]         ?? 0,
      precipitation: h.precipitation?.[i]        ?? 0,
    };
  });
}
