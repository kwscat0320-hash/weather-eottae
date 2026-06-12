// ECMWF CAMS 실시간 대기질 via Open-Meteo (replaces OpenWeather Air Pollution)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "lat, lon 필요" });

  try {
    const url =
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=pm10,pm2_5,nitrogen_dioxide,ozone,carbon_monoxide,european_aqi` +
      `&domains=cams_global`;

    const data = await fetch(url).then(r => r.json());
    if (data.error) throw new Error(data.reason || "ECMWF 대기질 오류");

    const c = data.current;
    if (!c) throw new Error("대기질 데이터 없음");

    const pm10 = Math.round(c.pm10  ?? 0);
    const pm25 = Math.round(c.pm2_5 ?? 0);

    return res.status(200).json({
      pm10,
      pm25,
      pm10Grade: pm10ToGrade(pm10),
      pm25Grade: pm25ToGrade(pm25),
      no2:    Math.round((c.nitrogen_dioxide ?? 0) * 10) / 10,
      o3:     Math.round((c.ozone            ?? 0) * 10) / 10,
      co:     Math.round((c.carbon_monoxide  ?? 0) * 10) / 10,
      euAqi:  Math.round(c.european_aqi      ?? 0),
      source: "ECMWF",
    });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}

function pm10ToGrade(val) {
  if (val <= 30)  return "1";
  if (val <= 80)  return "2";
  if (val <= 150) return "3";
  return "4";
}

function pm25ToGrade(val) {
  if (val <= 15) return "1";
  if (val <= 35) return "2";
  if (val <= 75) return "3";
  return "4";
}
