import { request } from "https";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "lat, lon 필요" });

  const key = process.env.KMA_KEY;
  if (!key) return res.status(500).json({ error: "KMA_KEY 없음" });

  const { landRegId, taRegId } = getRegionIds(Number(lat), Number(lon));
  const { tmFc, tmFcDate } = getTmFc();

  try {
    const [landRes, taRes] = await Promise.all([
      httpsGetJson(buildUrl("getMidLandFcst", key, { regId: landRegId, tmFc })),
      httpsGetJson(buildUrl("getMidTa",       key, { regId: taRegId,   tmFc })),
    ]);

    const landItems = landRes?.response?.body?.items?.item;
    const taItems   = taRes?.response?.body?.items?.item;

    const land = Array.isArray(landItems) ? landItems[0] : landItems;
    const ta   = Array.isArray(taItems)   ? taItems[0]   : taItems;

    if (!land || !ta) return res.status(502).json({ error: "중기예보 데이터 없음" });

    // 실제 응답에 존재하는 day 번호만 추출 (taMin3~taMin10)
    const availableDays = [];
    for (let n = 3; n <= 10; n++) {
      if (ta[`taMin${n}`] !== undefined) availableDays.push(n);
    }


    const forecast = [];
    for (const n of availableDays) {
      const taMin = ta[`taMin${n}`] ?? 0;
      const taMax = ta[`taMax${n}`] ?? 0;
      const rnSt  = land[`rnSt${n}Am`] ?? land[`rnSt${n}`] ?? 0;
      const wf    = land[`wf${n}Am`]   ?? land[`wf${n}`]   ?? "";

      // 발표일 기준 n일 후 날짜
      const date = new Date(tmFcDate);
      date.setDate(date.getDate() + n);
      const dateLabel = date.toLocaleDateString("ko-KR", {
        month: "numeric", day: "numeric", weekday: "short",
      });

      forecast.push({
        dateLabel,
        timeLabel: "일간",
        condition: wfToCondition(wf),
        temp: Math.round((taMin + taMax) / 2),
        tempMin: taMin,
        tempMax: taMax,
        rainChance: rnSt,
      });
    }

    return res.status(200).json({ forecast });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}

// ── 지역코드 매핑 ─────────────────────────────────────────────────────────────

function getRegionIds(lat, lon) {
  // 육상예보 regId / 기온예보 regId
  if (lat >= 37.4 && lon >= 126.0 && lon <= 127.5) return { landRegId: "11B10101", taRegId: "11B10101" }; // 서울/인천/경기북부
  if (lat >= 37.0 && lat < 37.4 && lon >= 126.5)  return { landRegId: "11B20101", taRegId: "11B20601" }; // 경기남부
  if (lat >= 36.5 && lat < 37.5 && lon >= 127.5 && lon < 129.0) return { landRegId: "11D10101", taRegId: "11D10301" }; // 강원영서
  if (lat >= 37.0 && lon >= 129.0)                 return { landRegId: "11D20101", taRegId: "11D20201" }; // 강원영동
  if (lat >= 36.0 && lat < 37.0 && lon >= 127.0 && lon < 128.5) return { landRegId: "11C10101", taRegId: "11C10301" }; // 충북
  if (lat >= 36.0 && lat < 37.0 && lon < 127.0)   return { landRegId: "11C20101", taRegId: "11C20401" }; // 충남/대전
  if (lat >= 35.5 && lat < 36.5 && lon >= 128.5)  return { landRegId: "11H10701", taRegId: "11H10701" }; // 경북
  if (lat >= 35.0 && lat < 36.0 && lon >= 128.0)  return { landRegId: "11H20201", taRegId: "11H20201" }; // 경남/부산
  if (lat >= 35.5 && lat < 36.5 && lon < 127.5)   return { landRegId: "11F10201", taRegId: "11F10201" }; // 전북
  if (lat >= 34.0 && lat < 35.5 && lon < 127.5)   return { landRegId: "11F20501", taRegId: "11F20501" }; // 전남/광주
  if (lat < 34.0)                                   return { landRegId: "11G00201", taRegId: "11G00201" }; // 제주
  return { landRegId: "11B10101", taRegId: "11B10101" }; // 기본: 서울
}

function getTmFc() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const h = now.getUTCHours();

  let base;
  if (h < 6) {
    base = new Date(now);
    base.setUTCDate(base.getUTCDate() - 1);
    base.setUTCHours(18, 0, 0, 0);
  } else if (h < 18) {
    base = new Date(now);
    base.setUTCHours(6, 0, 0, 0);
  } else {
    base = new Date(now);
    base.setUTCHours(18, 0, 0, 0);
  }

  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, "0");
  const d = String(base.getUTCDate()).padStart(2, "0");
  const hh = base.getUTCHours() === 6 ? "0600" : "1800";

  return { tmFc: `${y}${m}${d}${hh}`, tmFcDate: base };
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
