import { request } from "https";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "lat, lon 필요" });

  const key = process.env.KMA_KEY;
  if (!key) return res.status(500).json({ error: "KMA_KEY 없음" });

  try {
    // 1. WGS84 → TM 좌표 변환
    const { tmX, tmY } = wgs84ToTm(Number(lat), Number(lon));

    // 2. TM 좌표 → 가장 가까운 측정소
    const stationUrl = `https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList?serviceKey=${key.trim()}&returnType=json&tmX=${tmX}&tmY=${tmY}&ver=1.1`;
    const stationData = await httpsGetRaw(stationUrl);
    console.log("[AIR] stationRaw:", stationData.slice(0, 300));
    const stationJson = JSON.parse(stationData);
    const stationName = stationJson?.response?.body?.items?.[0]?.stationName;
    if (!stationName) throw new Error(`측정소 없음: ${stationData.slice(0, 200)}`);

    // 3. 측정소 → 실시간 대기오염 정보
    const airUrl = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty?serviceKey=${key.trim()}&returnType=json&numOfRows=1&pageNo=1&stationName=${encodeURIComponent(stationName)}&dataTerm=DAILY&ver=1.3`;
    const airData = await httpsGetJson(airUrl);
    const item = airData?.response?.body?.items?.[0];
    if (!item) throw new Error("대기오염 데이터 없음");

    return res.status(200).json({
      pm10: item.pm10Value ?? "-",
      pm25: item.pm25Value ?? "-",
      pm10Grade: item.pm10Grade ?? "0",
      pm25Grade: item.pm25Grade ?? "0",
      stationName,
    });
  } catch (err) {
    console.error("[AIR] error:", err.message);
    return res.status(200).json({ error: err.message });
  }
}

// WGS84 → TM(중부원점) 변환
function wgs84ToTm(lat, lon) {
  const PI = Math.PI;
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const b = a * (1 - f);
  const e2 = (a * a - b * b) / (a * a);
  const e = Math.sqrt(e2);

  // 중부원점 파라미터
  const lat0 = 38.0 * PI / 180;
  const lon0 = 127.0 * PI / 180;
  const k0 = 1.0;
  const dx = 200000.0;
  const dy = 500000.0;

  const latR = lat * PI / 180;
  const lonR = lon * PI / 180;

  const N = a / Math.sqrt(1 - e2 * Math.sin(latR) ** 2);
  const T = Math.tan(latR) ** 2;
  const C = (e2 / (1 - e2)) * Math.cos(latR) ** 2;
  const A = Math.cos(latR) * (lonR - lon0);

  const M = a * (
    (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * latR -
    (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * latR) +
    (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * latR) -
    (35 * e2 ** 3 / 3072) * Math.sin(6 * latR)
  );

  const M0 = a * (
    (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * lat0 -
    (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * lat0) +
    (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * lat0) -
    (35 * e2 ** 3 / 3072) * Math.sin(6 * lat0)
  );

  const x = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2) * A ** 5 / 120) + dx;
  const y = k0 * (M - M0 + N * Math.tan(latR) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24)) + dy;

  return { tmX: x.toFixed(6), tmY: y.toFixed(6) };
}

function httpsGetRaw(urlStr) {
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
      r.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.end();
  });
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