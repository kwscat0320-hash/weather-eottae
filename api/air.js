import { request } from "https";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "lat, lon 필요" });

  const key = process.env.KMA_KEY;
  if (!key) return res.status(500).json({ error: "KMA_KEY 없음" });

  try {
    // 1. 좌표 → 가장 가까운 측정소 이름
    const stationUrl = `https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList?serviceKey=${key}&returnType=json&tmX=${lon}&tmY=${lat}&ver=1.1`;
    console.log("[AIR] stationUrl:", stationUrl.slice(0, 120));
    const stationData = await httpsGetJson(stationUrl);
    console.log("[AIR] stationData:", JSON.stringify(stationData).slice(0, 300));
    const stationName = stationData?.response?.body?.items?.[0]?.stationName;
    if (!stationName) throw new Error(`측정소 없음: ${JSON.stringify(stationData).slice(0, 200)}`);

    // 2. 측정소 → 대기오염 정보
    const airUrl = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty?serviceKey=${key}&returnType=json&numOfRows=1&pageNo=1&stationName=${encodeURIComponent(stationName)}&dataTerm=DAILY&ver=1.3`;
    console.log("[AIR] airUrl:", airUrl.slice(0, 120));
    const airData = await httpsGetJson(airUrl);
    console.log("[AIR] airData:", JSON.stringify(airData).slice(0, 300));
    const item = airData?.response?.body?.items?.[0];
    if (!item) throw new Error(`대기오염 데이터 없음: ${JSON.stringify(airData).slice(0, 200)}`);

    return res.status(200).json({
      pm10: item.pm10Value ?? "-",
      pm25: item.pm25Value ?? "-",
      pm10Grade: item.pm10Grade ?? "0",
      pm25Grade: item.pm25Grade ?? "0",
      stationName,
    });
  } catch (err) {
    console.error("[AIR] error:", err.message);
    return res.status(502).json({ error: err.message });
  }
}

function httpsGetJson(urlStr) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const req = request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: { "User-Agent": "WeatherApp/1.0", "Accept": "application/json" },
    }, (r) => {
      let body = "";
      r.on("data", (c) => (body += c));
      r.on("end", () => { try { resolve(JSON.parse(body)); } catch { reject(new Error("JSON 파싱 실패")); } });
    });
    req.on("error", reject);
    req.end();
  });
}
