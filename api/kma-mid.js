
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "lat, lon 필요" });

  const hubKey = process.env.KMA_HUB_KEY;
  if (!hubKey) return res.status(500).json({ error: "KMA_HUB_KEY 없음" });

  const { taRegId, fctRegId } = getRegionIds(Number(lat), Number(lon));
  const issuances = getIssuances();

  try {
    // ── 기온: getMidTa (data.go.kr, 06:00+18:00 발표) ─────────────────────
    const taResults = await Promise.all(
      issuances.map(({ tmFc }) =>
        fetchJson(buildMidUrl("getMidTa", hubKey, { regId: taRegId, tmFc })).catch(() => null)
      )
    );

    const tempByDate = {};
    for (let i = 0; i < issuances.length; i++) {
      const ta = getItem(taResults[i]);
      if (!ta) continue;
      const { tmFcDate } = issuances[i];
      for (let n = 3; n <= 10; n++) {
        const minVal = parseFloat(ta[`taMin${n}`]);
        const maxVal = parseFloat(ta[`taMax${n}`]);
        if (isNaN(minVal) || isNaN(maxVal)) continue;
        const date = new Date(tmFcDate);
        date.setDate(date.getDate() + n);
        const dateStr = toDateStr(date);
        tempByDate[dateStr] = { tempMin: minVal, tempMax: maxVal };
      }
    }

    // ── 날씨코드+강수확률: fct_afs_wl (apihub) ────────────────────────────
    const { tmfc1, tmfc2, tmef1, tmef2 } = getAfsParams();
    const afsUrl =
      `https://apihub.kma.go.kr/api/typ01/url/fct_afs_wl.php` +
      `?reg=${fctRegId}&tmfc1=${tmfc1}&tmfc2=${tmfc2}` +
      `&tmef1=${tmef1}&tmef2=${tmef2}&disp=0&help=0&authKey=${hubKey}`;
    const afsText = await fetchText(afsUrl).catch(() => "");
    const afsRows = parseAfsWl(afsText);

    const condByDate = {};
    for (const row of afsRows) {
      const dateStr = row.tmEf.slice(0, 8);
      if (!condByDate[dateStr]) {
        condByDate[dateStr] = { amSky: null, amPre: null, amRnSt: 0, pmSky: null, pmPre: null, pmRnSt: 0 };
      }
      const c = condByDate[dateStr];
      if (row.tmEf.slice(8) === "0000") {
        c.amSky = row.sky; c.amPre = row.pre; c.amRnSt = row.rnSt;
      } else {
        c.pmSky = row.sky; c.pmPre = row.pre; c.pmRnSt = row.rnSt;
      }
    }

    // ── 날짜별 병합 ────────────────────────────────────────────────────────
    const allDates = new Set([...Object.keys(tempByDate), ...Object.keys(condByDate)]);
    const entries = [];
    for (const dateStr of allDates) {
      const temp = tempByDate[dateStr];
      const cond = condByDate[dateStr];
      const sky = cond?.pmSky ?? cond?.amSky ?? null;
      const pre = cond?.pmPre ?? cond?.amPre ?? null;
      const rainChance = Math.max(cond?.amRnSt ?? 0, cond?.pmRnSt ?? 0);
      const label = makeDateLabel(dateStr);
      const [, mm, dd] = label.match(/(\d+)\.\s*(\d+)/) || [];
      entries.push({
        dateLabel: label,
        timeLabel: "일간",
        condition: skyToCondition(sky, pre),
        rainChance,
        tempMin: temp?.tempMin ?? null,
        tempMax: temp?.tempMax ?? null,
        _ts: mm && dd ? Number(mm) * 100 + Number(dd) : 0,
      });
    }

    const forecast = entries
      .sort((a, b) => a._ts - b._ts)
      .map(({ _ts, ...rest }) => rest);

    return res.status(200).json({ forecast });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}

// ── fct_afs_wl 텍스트 파싱 ────────────────────────────────────────────────

function parseAfsWl(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    // WF 필드(따옴표로 감싸진 부분)를 단일 토큰 X로 치환 후 공백 분리
    const cleaned = trimmed.replace(/"[^"]*"/, "X");
    const parts = cleaned.trim().split(/\s+/);
    if (parts.length < 11) continue;
    rows.push({
      tmFc: parts[1],
      tmEf: parts[2],
      sky:  parts[6],
      pre:  parts[7],
      rnSt: parseInt(parts[10]) || 0,
    });
  }
  return rows;
}

// ── SKY/PRE 코드 → 날씨 조건 ─────────────────────────────────────────────
// SKY: WB01=맑음, WB02=구름많음, WB03=흐림, WB04=강우
// PRE: WB09=비,   WB11=비/눈,   WB12=눈,   WB13=눈/비

function skyToCondition(sky, pre) {
  if (!sky) return null;
  if (pre === "WB11") return "비/눈";
  if (pre === "WB13") return "눈/비";
  if (pre === "WB12") return "눈";
  if (pre === "WB09" || sky === "WB04") return "비";
  if (sky === "WB01") return "맑음";
  if (sky === "WB02") return "구름많음";
  if (sky === "WB03") return "흐림";
  return null;
}

// ── fct_afs_wl 쿼리 파라미터 ─────────────────────────────────────────────

function getAfsParams() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const h = now.getUTCHours();

  const fmt8  = d => `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,"0")}${String(d.getUTCDate()).padStart(2,"0")}`;
  const fmt10 = (d, hh) => fmt8(d) + String(hh).padStart(2, "0");

  let tmfc1, tmfc2;
  if (h < 6) {
    const yest = new Date(now);
    yest.setUTCDate(yest.getUTCDate() - 1);
    tmfc1 = fmt10(yest, 6);
    tmfc2 = fmt10(yest, 18);
  } else if (h < 18) {
    tmfc1 = tmfc2 = fmt10(now, 6);
  } else {
    tmfc1 = fmt10(now, 6);
    tmfc2 = fmt10(now, 18);
  }

  const ef1 = new Date(now); ef1.setUTCDate(ef1.getUTCDate() + 3);
  const ef2 = new Date(now); ef2.setUTCDate(ef2.getUTCDate() + 10);

  return { tmfc1, tmfc2, tmef1: fmt8(ef1), tmef2: fmt8(ef2) };
}

// ── getMidTa 발표 목록 ────────────────────────────────────────────────────
// 18:00 이후: 06:00(n=4 포함) + 18:00(n=5~10 최신값)
// 06:00~18:00: 오늘 06:00 / 자정~06:00: 어제 18:00

function getIssuances() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const h = now.getUTCHours();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const todayStr = `${y}${m}${d}`;

  function mkDate(s) {
    return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T06:00:00Z`);
  }

  if (h >= 18) {
    // 오늘 06:00(n=4 포함) + 오늘 18:00(n=5~10 최신값)
    return [
      { tmFc: `${todayStr}0600`, tmFcDate: mkDate(todayStr) },
      { tmFc: `${todayStr}1800`, tmFcDate: mkDate(todayStr) },
    ];
  } else if (h >= 6) {
    // 오늘 06:00(n=4 포함)
    return [{ tmFc: `${todayStr}0600`, tmFcDate: mkDate(todayStr) }];
  } else {
    // 자정~06시: 어제 06:00(n=4=월요일) + 어제 18:00(n=5~10)
    const yest = new Date(now);
    yest.setUTCDate(yest.getUTCDate() - 1);
    const yStr = `${yest.getUTCFullYear()}${String(yest.getUTCMonth()+1).padStart(2,"0")}${String(yest.getUTCDate()).padStart(2,"0")}`;
    return [
      { tmFc: `${yStr}0600`, tmFcDate: mkDate(yStr) },
      { tmFc: `${yStr}1800`, tmFcDate: mkDate(yStr) },
    ];
  }
}

// ── 날짜 헬퍼 ─────────────────────────────────────────────────────────────

function makeDateLabel(dateStr) {
  const y = dateStr.slice(0, 4), m = dateStr.slice(4, 6), d = dateStr.slice(6, 8);
  return new Date(`${y}-${m}-${d}T03:00:00Z`).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short",
  });
}

function toDateStr(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// ── 지역 코드 매핑 ────────────────────────────────────────────────────────

function getRegionIds(lat, lon) {
  const map = [
    [() => lat >= 37.4 && lon >= 126.0 && lon <= 127.5,              "11B10101", "11B00000"],
    [() => lat >= 37.0 && lat < 37.4  && lon >= 126.5,               "11B20601", "11B00000"],
    [() => lat >= 36.5 && lat < 37.5  && lon >= 127.5 && lon < 129.0,"11D10301", "11D10000"],
    [() => lat >= 37.0 && lon >= 129.0,                               "11D20201", "11D20000"],
    [() => lat >= 36.0 && lat < 37.0  && lon >= 127.0 && lon < 128.5,"11C10301", "11C10000"],
    [() => lat >= 36.0 && lat < 37.0  && lon < 127.0,                "11C20401", "11C20000"],
    [() => lat >= 35.5 && lat < 36.5  && lon >= 128.5,               "11H10701", "11H10000"],
    [() => lat >= 35.0 && lat < 36.0  && lon >= 128.0,               "11H20201", "11H20000"],
    [() => lat >= 35.5 && lat < 36.5  && lon < 127.5,                "11F10201", "11F10000"],
    [() => lat >= 34.0 && lat < 35.5  && lon < 127.5,                "11F20501", "11F20000"],
    [() => lat < 34.0,                                                "11G00201", "11G00000"],
  ];
  for (const [cond, taRegId, fctRegId] of map) {
    if (cond()) return { taRegId, fctRegId };
  }
  return { taRegId: "11B10101", fctRegId: "11B00000" };
}

// ── HTTP 헬퍼 ─────────────────────────────────────────────────────────────

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "WeatherApp/1.0", "Accept": "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "WeatherApp/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function getItem(res) {
  const items = res?.response?.body?.items?.item;
  return Array.isArray(items) ? items[0] : items;
}

function buildMidUrl(endpoint, key, params) {
  const p = new URLSearchParams({ pageNo: "1", numOfRows: "10", dataType: "JSON", ...params });
  return `https://apihub.kma.go.kr/api/typ02/openApi/MidFcstInfoService/${endpoint}?authKey=${key}&${p}`;
}
