import { request } from "https";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "lat, lon 필요" });

  const key = process.env.KMA_KEY;
  if (!key) return res.status(500).json({ error: "KMA_KEY 없음" });

  const { landRegId, taRegId } = getRegionIds(Number(lat), Number(lon));
  // 2일전, 1일전, 오늘 (우선순위 낮→높, 나중에 덮어씀)
  const issuances = [getTmFc(2), getTmFc(1), getTmFc(0)];

  try {
    const results = await Promise.all(
      issuances.flatMap(({ tmFc }) => [
        httpsGetJson(buildUrl("getMidLandFcst", key, { regId: landRegId, tmFc })).catch(() => null),
        httpsGetJson(buildUrl("getMidTa",       key, { regId: taRegId,   tmFc })).catch(() => null),
      ])
    );

    const byDate = {};

    for (let i = 0; i < issuances.length; i++) {
      const { tmFcDate } = issuances[i];
      const land = getItem(results[i * 2]);
      const ta   = getItem(results[i * 2 + 1]);
      if (!land || !ta) continue;

      for (let n = 3; n <= 10; n++) {
        if (ta[`taMin${n}`] === undefined) continue;
        const date = new Date(tmFcDate);
        date.setDate(date.getDate() + n);
        const label = toLabel(date);
        byDate[label] = makeEntry(label, ta, land, n);
      }
    }

    const forecast = Object.values(byDate)
      .sort((a, b) => a._ts - b._ts)
      .map(({ _ts, ...rest }) => rest);

    return res.status(200).json({ forecast });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}

function makeEntry(label, ta, land, n) {
  const taMin = ta[`taMin${n}`] ?? 0;
  const taMax = ta[`taMax${n}`] ?? 0;
  const rnSt  = land[`rnSt${n}Am`] ?? land[`rnSt${n}`] ?? 0;
  const wf    = land[`wf${n}Am`]   ?? land[`wf${n}`]   ?? "";
  const parts = label.match(/(\d+)\.\s*(\d+)/);
  const ts = parts ? Number(parts[1]) * 100 + Number(parts[2]) : 0;
  return { dateLabel: label, timeLabel: "일간", condition: wfToCondition(wf),
    temp: Math.round((taMin + taMax) / 2), tempMin: taMin, tempMax: taMax,
    rainChance: rnSt, _ts: ts };
}

function getItem(res) {
  const items = res?.response?.body?.items?.item;
  return Array.isArray(items) ? items[0] : items;
}

function toLabel(date) {
  return date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
}

function getRegionIds(lat, lon) {
  if (lat >= 37.4 && lon >= 126.0 && lon <= 127.5) return { landRegId: "11B10101", taRegId: "11B10101" };
  if (lat >= 37.0 && lat < 37.4 && lon >= 126.5)  return { landRegId: "11B20101", taRegId: "11B20601" };
  if (lat >= 36.5 && lat < 37.5 && lon >= 127.5 && lon < 129.0) return { landRegId: "11D10101", taRegId: "11D10301" };
  if (lat >= 37.0 && lon >= 129.0)                 return { landRegId: "11D20101", taRegId: "11D20201" };
  if (lat >= 36.0 && lat < 37.0 && lon >= 127.0 && lon < 128.5) return { landRegId: "11C10101", taRegId: "11C10301" };
  if (lat >= 36.0 && lat < 37.0 && lon < 127.0)   return { landRegId: "11C20101", taRegId: "11C20401" };
  if (lat >= 35.5 && lat < 36.5 && lon >= 128.5)  return { landRegId: "11H10701", taRegId: "11H10701" };
  if (lat >= 35.0 && lat < 36.0 && lon >= 128.0)  return { landRegId: "11H20201", taRegId: "11H20201" };
  if (lat >= 35.5 && lat < 36.5 && lon < 127.5)   return { landRegId: "11F10201", taRegId: "11F10201" };
  if (lat >= 34.0 && lat < 35.5 && lon < 127.5)   return { landRegId: "11F20501", taRegId: "11F20501" };
  if (lat < 34.0)                                   return { landRegId: "11G00201", taRegId: "11G00201" };
  return { landRegId: "11B10101", taRegId: "11B10101" };
}

function getTmFc(daysAgo = 0) {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const h = now.getUTCHours();
  const base = new Date(now);
  if (h < 6) base.setUTCDate(base.getUTCDate() - 1);
  base.setUTCDate(base.getUTCDate() - daysAgo);
  base.setUTCHours(6, 0, 0, 0);
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, "0");
  const d = String(base.getUTCDate()).padStart(2, "0");
  return { tmFc: `${y}${m}${d}0600`, tmFcDate: base };
}

function wfToCondition(wf = "") {
  if (wf.includes("비/눈") || wf.includes("눈/비")) return "비/눈";
  if (wf.includes("눈")) return "눈";
  if (wf.includes("비") || wf.includes("소나기")) return "비";
  if (wf.includes("흐림")) return "흐림";
  if (wf.includes("구름많음")) return "구름많음";
  return "맑음";
}

function buildUrl(endpoint, key, params) {
  const p = new URLSearchParams({ pageNo: "1", numOfRows: "10", dataType: "JSON", ...params });
  return `https://apis.data.go.kr/1360000/MidFcstInfoService/${endpoint}?serviceKey=${key}&${p}`;
}

function httpsGetJson(urlStr) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const req = request({ hostname: parsed.hostname, path: parsed.pathname + parsed.search, method: "GET",
      headers: { "User-Agent": "WeatherApp/1.0", "Accept": "application/json" } }, (r) => {
      let body = "";
      r.on("data", (c) => (body += c));
      r.on("end", () => { try { resolve(JSON.parse(body)); } catch { reject(new Error("JSON 파싱 실패")); } });
    });
    req.on("error", reject);
    req.end();
  });
}