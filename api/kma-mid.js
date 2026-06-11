
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "lat, lon 필요" });

  const key = process.env.KMA_KEY;
  if (!key) return res.status(500).json({ error: "KMA_KEY 없음" });

  const { landRegId, taRegId } = getRegionIds(Number(lat), Number(lon));
  const issuances = getIssuances();

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
        const entry = makeEntry(label, ta, land, n);
        if (entry) byDate[label] = entry;
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
  const minVal = parseFloat(ta[`taMin${n}`]);
  const maxVal = parseFloat(ta[`taMax${n}`]);
  if (isNaN(minVal) || isNaN(maxVal)) return null;
  const taMin = minVal;
  const taMax = maxVal;
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
  return date.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short" });
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

// 18:00 이후: 06:00(n=4 포함) + 18:00(n=5~10 최신값) 둘 다 쿼리
// 06:00~18:00: 오늘 06:00만 / 자정~06:00: 어제 18:00만
function getIssuances() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const h = now.getUTCHours();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const todayStr = `${y}${m}${d}`;

  function mkDate(dateStr) {
    return new Date(`${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}T06:00:00Z`);
  }

  if (h >= 18) {
    return [
      { tmFc: `${todayStr}0600`, tmFcDate: mkDate(todayStr) },
      { tmFc: `${todayStr}1800`, tmFcDate: mkDate(todayStr) },
    ];
  } else if (h >= 6) {
    return [{ tmFc: `${todayStr}0600`, tmFcDate: mkDate(todayStr) }];
  } else {
    const yest = new Date(now);
    yest.setUTCDate(yest.getUTCDate() - 1);
    const yStr = `${yest.getUTCFullYear()}${String(yest.getUTCMonth()+1).padStart(2,"0")}${String(yest.getUTCDate()).padStart(2,"0")}`;
    return [{ tmFc: `${yStr}1800`, tmFcDate: mkDate(yStr) }];
  }
}

function wfToCondition(wf = "") {
  if (!wf) return null;
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

async function httpsGetJson(urlStr) {
  const res = await fetch(urlStr, { headers: { "User-Agent": "WeatherApp/1.0", "Accept": "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}