// GET /api/geocode?lat=37.535&lon=126.739
// 카카오 로컬 API 역지오코딩 (행정동 단위)

import { request } from "https";

function httpsGetJson(urlStr, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const req = request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: { "Accept": "application/json", ...headers },
    }, (r) => {
      let body = "";
      r.on("data", (c) => (body += c));
      r.on("end", () => { try { resolve(JSON.parse(body)); } catch { reject(new Error("JSON 파싱 실패")); } });
    });
    req.on("error", reject);
    req.end();
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "lat, lon 필요" });

  const kakaoKey = process.env.kakao_key;
  if (!kakaoKey) {
    const keys = Object.keys(process.env).filter(k => k.includes("KAKAO") || k.includes("kakao"));
    return res.status(500).json({ error: "kakao_key 미설정", availableKakaoKeys: keys });
  }

  try {
    const data = await httpsGetJson(
      `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lon}&y=${lat}`,
      { Authorization: `KakaoAK ${kakaoKey}` }
    );

    // H(행정동) 우선, 없으면 B(법정동)
    const h = data.documents?.find(d => d.region_type === "H");
    const b = data.documents?.find(d => d.region_type === "B");
    const doc = h || b;

    return res.status(200).json({ _debug: { documents: data.documents, doc } });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
