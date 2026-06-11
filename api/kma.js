import { kv } from "@vercel/kv";
import { dfsXyConv } from "./_kma-utils.js";

const CACHE_TTL_SEC = 600;
const HISTORY_TTL_SEC = 604800;
const HISTORY_MAX = 72;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { lat, lon, force } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: "lat, lon 파라미터가 필요합니다." });
  }

  const rawKey = process.env.KMA_KEY;
  if (!rawKey) {
    return res.status(500).json({ error: "KMA_KEY 환경변수가 설정되지 않았습니다." });
  }

  const grid = dfsXyConv(Number(lat), Number(lon));
  const cacheKey = `kma:latest:v4:${grid.x}:${grid.y}`;

  console.log(`[KMA] lat=${lat} lon=${lon} force=${force} grid=${grid.x},${grid.y}`);

  if (!force && process.env.KV_REST_API_URL) {
    try {
      const cached = await kv.get(cacheKey);
      if (cached) {
        const age = Date.now() - cached.savedAt;
        if (age < CACHE_TTL_SEC * 1000) {
          res.setHeader("X-Cache", "HIT");
          return res.status(200).json(cached.data);
        }
      }
    } catch (e) {
      console.warn("[KMA cache] KV read failed:", e.message);
    }
  }

  const trimmedKey = rawKey.trim();
  const { date, ncstDate, ncstTime, ultraDate, ultraTime, vilageTime } = getKmaBaseDateTime();

  const [ncstRes, ultraFcstRes, vilageFcstRes] = await Promise.allSettled([
    kmaFetch(buildKmaUrl("getUltraSrtNcst", trimmedKey, ncstDate,  ncstTime,  grid, 100)),
    kmaFetch(buildKmaUrl("getUltraSrtFcst", trimmedKey, ultraDate, ultraTime, grid, 200)),
    kmaFetch(buildKmaUrl("getVilageFcst",   trimmedKey, date,      vilageTime, grid, 2000)),
  ]);

  try {
    const ncstItems       = parseKmaResult(ncstRes,       "초단기실황");
    const ultraFcstItems  = parseKmaResult(ultraFcstRes,  "초단기예보");
    const vilageFcstItems = parseKmaResult(vilageFcstRes, "단기예보");

    const current  = buildCurrent(ncstItems, ultraFcstItems, vilageFcstItems);
    const forecast = buildForecast(vilageFcstItems, ultraFcstItems);
    const data = { current, forecast };

    if (process.env.KV_REST_API_URL) {
      try {
        const now = Date.now();
        await kv.set(cacheKey, { savedAt: now, data }, { ex: CACHE_TTL_SEC + 3600 });
        const bucket = Math.floor(now / (CACHE_TTL_SEC * 1000));
        const histKey = `kma:history:${grid.x}:${grid.y}:${bucket}`;
        await kv.set(histKey, { savedAt: now, data }, { ex: HISTORY_TTL_SEC });
        const idxKey = `kma:index:${grid.x}:${grid.y}`;
        const idx = (await kv.get(idxKey)) || [];
        const newIdx = [bucket, ...idx.filter(b => b !== bucket)].slice(0, HISTORY_MAX);
        await kv.set(idxKey, newIdx, { ex: HISTORY_TTL_SEC });
      } catch (e) {
        console.warn("[KMA cache] KV write failed:", e.message);
      }
    }

    res.setHeader("X-Cache", "MISS");
    return res.status(200).json(data);
  } catch (err) {
    console.error("[KMA] error:", err.message);
    return res.status(502).json({ error: err.message });
  }
}

// ── HTTP 요청 ─────────────────────────────────────────────────────────────────

async function kmaFetch(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "WeatherApp/1.0", "Accept": "application/json" },
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text };
}

// ── KMA URL 빌더 ──────────────────────────────────────────────────────────────

function buildKmaUrl(endpoint, key, baseDate, baseTime, grid, rows) {
  const params = new URLSearchParams({
    pageNo: "1",
    numOfRows: String(rows),
    dataType: "JSON",
    base_date: baseDate,
    base_time: baseTime,
    nx: String(grid.x),
    ny: String(grid.y),
  });
  return `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/${endpoint}?serviceKey=${key}&${params}`;
}

// ── 응답 파싱 ─────────────────────────────────────────────────────────────────

function parseKmaResult(result, label) {
  if (result.status !== "fulfilled") throw new Error(`${label} 요청 실패`);
  const { ok, status, body } = result.value;
  if (!ok) {
    console.log(`[KMA] ${label} ${status} body:`, body.slice(0, 300));
    throw new Error(`${label} HTTP ${status}`);
  }
  let data;
  try { data = JSON.parse(body); } catch { throw new Error(`${label} 응답이 JSON이 아닙니다`); }
  const code = data?.response?.header?.resultCode;
  const msg  = data?.response?.header?.resultMsg;
  if (code && code !== "00") throw new Error(`${label} 오류: ${msg || code}`);
  const raw = data?.response?.body?.items?.item;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

// ── 현재 날씨 빌드 ────────────────────────────────────────────────────────────

function buildCurrent(ncstItems, ultraFcstItems, vilageFcstItems) {
  const nowMap = toMap(ncstItems, "category", "obsrValue");

  const ultraGroups  = groupByDateTime(ultraFcstItems);
  const firstUltra   = ultraGroups[0]  ?? {};
  const villageGroups = groupByDateTime(vilageFcstItems);
  const firstVillage = villageGroups[0] ?? {};

  const temp     = Number(nowMap.T1H ?? firstUltra.T1H  ?? firstVillage.TMP ?? 0);
  const humidity = Number(nowMap.REH ?? firstUltra.REH  ?? firstVillage.REH ?? 0);
  const wind     = Number(nowMap.WSD ?? firstUltra.WSD  ?? firstVillage.WSD ?? 0);
  const sky = firstUltra.SKY ?? firstVillage.SKY;
  const pty = nowMap.PTY ?? firstUltra.PTY ?? firstVillage.PTY ?? "0";

  // 오늘 TMX/TMN: fcstDate는 KST YYYYMMDD이므로 KST 오늘 날짜와 직접 비교
  const today = kstToday();
  const todayItems = vilageFcstItems.filter(i => i.fcstDate === today);
  const tmxItem = todayItems.find(i => i.category === "TMX");
  const tmnItem = todayItems.find(i => i.category === "TMN");
  const todayTmps = todayItems.filter(i => i.category === "TMP")
    .map(i => Number(i.fcstValue)).filter(v => !isNaN(v));

  const high = tmxItem ? Number(tmxItem.fcstValue) : (todayTmps.length ? Math.max(...todayTmps) : temp);
  const low  = tmnItem ? Number(tmnItem.fcstValue) : (todayTmps.length ? Math.min(...todayTmps) : temp);

  const ncst0 = ncstItems[0];
  const observedAt = ncst0
    ? `${ncst0.baseTime.slice(0, 2)}:${ncst0.baseTime.slice(2, 4)} (기상청 실측)`
    : null;

  return {
    condition: getCondition(sky, pty),
    icon:      getIcon(sky, pty),
    temp,
    feelsLike: calcFeelsLike(temp, wind),
    high,
    low,
    rainChance: Number(firstUltra.POP ?? firstVillage.POP ?? 0),
    humidity,
    wind,
    observedAt,
  };
}

// ── 예보 빌드 ─────────────────────────────────────────────────────────────────

function buildForecast(vilageFcstItems, ultraFcstItems) {
  const items = vilageFcstItems.length ? vilageFcstItems : ultraFcstItems;

  // fcstDate별 공식 TMX/TMN 수집 — fcstDate는 KST 날짜(YYYYMMDD), 타임존 변환 불필요
  const tmxByDate = {};
  const tmnByDate = {};
  for (const item of items) {
    if (item.category === "TMX") tmxByDate[item.fcstDate] = Number(item.fcstValue);
    if (item.category === "TMN") tmnByDate[item.fcstDate] = Number(item.fcstValue);
  }

  // fcstDate+fcstTime 기준으로 슬롯 병합
  const slotMap = {};
  for (const item of items) {
    const key = item.fcstDate + item.fcstTime;
    if (!slotMap[key]) slotMap[key] = { fcstDate: item.fcstDate, fcstTime: item.fcstTime };
    slotMap[key][item.category] = item.fcstValue;
  }

  const slots = Object.values(slotMap).sort((a, b) =>
    (a.fcstDate + a.fcstTime).localeCompare(b.fcstDate + b.fcstTime)
  );

  // POP은 3시간 간격 → 중간 슬롯에 없으면 이전 값 유지
  let lastPop = 0;
  return slots.slice(0, 72).map(slot => {
    const { fcstDate, fcstTime } = slot;
    if (slot.POP != null) lastPop = Number(slot.POP);

    const tmx = tmxByDate[fcstDate] ?? null;
    const tmn = tmnByDate[fcstDate] ?? null;

    return {
      dateLabel:   makeDateLabel(fcstDate),
      timeLabel:   `${fcstTime.slice(0, 2)}:00`,
      isoTime:     kstToISO(fcstDate, fcstTime),
      officialTMX: tmx,
      officialTMN: tmn,
      temp:        slot.TMP != null ? Number(slot.TMP) : null,
      tempMax:     tmx,
      tempMin:     tmn,
      rainChance:  slot.POP != null ? Number(slot.POP) : lastPop,
      condition:   getCondition(slot.SKY, slot.PTY),
      icon:        getIcon(slot.SKY, slot.PTY),
      humidity:    slot.REH != null ? Number(slot.REH) : 0,
      wind:        slot.WSD != null ? Number(slot.WSD) : 0,
      precipitation: slot.PCP === "강수없음" ? 0 : (parseFloat(slot.PCP) || 0),
    };
  });
}

// ── 날짜 헬퍼 ─────────────────────────────────────────────────────────────────

// fcstDate(YYYYMMDD, KST) → "M. D. (요)" — kma-mid.js toLabel()과 동일 포맷 보장
// 03:00 UTC = 12:00 KST 로 Date를 만들어 날짜 경계 오류 원천 차단
function makeDateLabel(fcstDate) {
  const y = fcstDate.slice(0, 4);
  const m = fcstDate.slice(4, 6);
  const d = fcstDate.slice(6, 8);
  return new Date(`${y}-${m}-${d}T03:00:00Z`).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}

// fcstDate+fcstTime(KST) → ISO UTC 문자열
function kstToISO(fcstDate, fcstTime) {
  const y  = fcstDate.slice(0, 4);
  const mo = fcstDate.slice(4, 6);
  const d  = fcstDate.slice(6, 8);
  const h  = fcstTime.slice(0, 2);
  const mi = fcstTime.slice(2, 4);
  // ISO 8601 with +09:00 offset — JS Date handles this correctly
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:00+09:00`).toISOString();
}

// KST 오늘 날짜 → YYYYMMDD
function kstToday() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// ── 기타 헬퍼 ─────────────────────────────────────────────────────────────────

function groupByDateTime(items) {
  const map = {};
  for (const item of items) {
    const key = `${item.fcstDate}-${item.fcstTime}`;
    if (!map[key]) map[key] = { fcstDate: item.fcstDate, fcstTime: item.fcstTime };
    map[key][item.category] = item.fcstValue;
  }
  return Object.values(map).sort((a, b) =>
    (a.fcstDate + a.fcstTime).localeCompare(b.fcstDate + b.fcstTime)
  );
}

function toMap(items, keyField, valueField) {
  return items.reduce((acc, item) => { acc[item[keyField]] = item[valueField]; return acc; }, {});
}

function getCondition(sky, pty) {
  const p = String(pty ?? "0");
  const s = String(sky ?? "1");
  if (p === "1") return "비";
  if (p === "2") return "비/눈";
  if (p === "3") return "눈";
  if (p === "4") return "소나기";
  if (s === "1") return "맑음";
  if (s === "3") return "구름많음";
  if (s === "4") return "흐림";
  return null;
}

function getIcon(sky, pty) {
  const p = String(pty ?? "0");
  const s = String(sky ?? "1");
  if (p === "1" || p === "4") return "10d";
  if (p === "2" || p === "3") return "13d";
  if (s === "1") return "01d";
  if (s === "3") return "03d";
  if (s === "4") return "04d";
  return "02d";
}

function calcFeelsLike(temp, wind) {
  if (temp <= 10 && wind >= 1.3) return temp - Math.min(5, wind * 0.5);
  return temp;
}

function getKmaBaseDateTime() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000); // fake-KST (UTC+9)

  const ncst = new Date(now);
  if (ncst.getUTCMinutes() < 10) ncst.setUTCHours(ncst.getUTCHours() - 1);

  const ultra = new Date(now);
  if (ultra.getUTCMinutes() < 45) ultra.setUTCHours(ultra.getUTCHours() - 1);

  const village = new Date(now);
  const hhmm = village.getUTCHours() * 100 + village.getUTCMinutes();
  const baseTimes = [2300, 2000, 1700, 1400, 1100, 800, 500, 200];
  let selected = baseTimes.find(t => hhmm >= t + 10);
  if (!selected) {
    village.setUTCDate(village.getUTCDate() - 1);
    selected = 2300;
  }

  const fmt = (d) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${m}${dd}`;
  };

  return {
    date:      fmt(village),
    ncstDate:  fmt(ncst),
    ncstTime:  `${String(ncst.getUTCHours()).padStart(2, "0")}00`,
    ultraDate: fmt(ultra),
    ultraTime: `${String(ultra.getUTCHours()).padStart(2, "0")}00`,
    vilageTime: String(selected).padStart(4, "0"),
  };
}
