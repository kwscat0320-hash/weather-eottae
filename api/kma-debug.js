// GET /api/kma-debug?lat=37.5665&lon=126.978
// 기상청 raw 데이터 및 최고/최저 계산 과정 반환

import { request } from "https";
import { dfsXyConv } from "./_kma-utils.js";

function httpsGet(urlStr) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const req = request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
    }, (r) => {
      let body = "";
      r.on("data", (c) => (body += c));
      r.on("end", () => resolve({ ok: r.statusCode < 300, status: r.statusCode, text: () => body, json: () => JSON.parse(body) }));
    });
    req.on("error", reject);
    req.end();
  });
}

function formatYMD(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function getKmaBaseDateTime() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const ultra = new Date(now);
  if (ultra.getUTCMinutes() < 45) ultra.setUTCHours(ultra.getUTCHours() - 1);
  const village = new Date(now);
  const hhmm = village.getUTCHours() * 100 + village.getUTCMinutes();
  const baseTimes = [2300, 2000, 1700, 1400, 1100, 800, 500, 200];
  let selected = baseTimes.find((t) => hhmm >= t + 10);
  if (!selected) { village.setUTCDate(village.getUTCDate() - 1); selected = 2300; }
  return {
    date: formatYMD(village),
    ultraDate: formatYMD(ultra),
    ultraTime: `${String(ultra.getUTCHours()).padStart(2, "0")}00`,
    vilageTime: String(selected).padStart(4, "0"),
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "lat, lon 필요" });

  const key = process.env.KMA_KEY?.trim();
  if (!key) return res.status(500).json({ error: "KMA_KEY 없음" });

  const grid = dfsXyConv(Number(lat), Number(lon));
  const { date, ultraDate, ultraTime, vilageTime } = getKmaBaseDateTime();
  const today = formatYMD(new Date(Date.now() + 9 * 60 * 60 * 1000));

  const makeUrl = (ep, d, t, rows) => {
    const p = new URLSearchParams({ pageNo: "1", numOfRows: String(rows), dataType: "JSON", base_date: d, base_time: t, nx: String(grid.x), ny: String(grid.y) });
    return `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/${ep}?serviceKey=${key}&${p}`;
  };

  try {
    // 단기예보만 가져와서 TMX/TMN/TMP 확인
    const r = await httpsGet(makeUrl("getVilageFcst", date, vilageTime, 1000));
    const raw = await r.json();
    const items = raw?.response?.body?.items?.item ?? [];

    const todayItems = items.filter(i => i.fcstDate === today);
    const tmxItem = todayItems.find(i => i.category === "TMX");
    const tmnItem = todayItems.find(i => i.category === "TMN");
    const tmpItems = todayItems.filter(i => i.category === "TMP");

    const tmpValues = tmpItems.map(i => Number(i.fcstValue));

    return res.status(200).json({
      grid,
      baseDate: date,
      baseTime: vilageTime,
      today,
      result: {
        TMX: tmxItem ? { fcstTime: tmxItem.fcstTime, value: tmxItem.fcstValue } : null,
        TMN: tmnItem ? { fcstTime: tmnItem.fcstTime, value: tmnItem.fcstValue } : null,
        TMP_count: tmpValues.length,
        TMP_max: tmpValues.length ? Math.max(...tmpValues) : null,
        TMP_min: tmpValues.length ? Math.min(...tmpValues) : null,
        TMP_slots: tmpItems.map(i => ({ time: i.fcstTime, value: i.fcstValue })),
      },
      totalItems: items.length,
      todayItemCategories: [...new Set(todayItems.map(i => i.category))],
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
