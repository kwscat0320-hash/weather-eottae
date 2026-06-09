import { request } from "https";
import { kv } from "@vercel/kv";
import { dfsXyConv } from "./_kma-utils.js";

const CACHE_TTL_SEC = 7200;      // 캐시 유효 시간: 2시간
const HISTORY_TTL_SEC = 259200;  // 히스토리 보존: 3일
const HISTORY_MAX = 36;          // 최대 스냅샷 수 (3일 × 12개/일)

// Vercel 서버리스 프록시 — 브라우저 CORS 우회용

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
  const cacheKey = `kma:latest:${grid.x}:${grid.y}`;

  console.log(`[KMA] lat=${lat} lon=${lon} force=${force} grid=${grid.x},${grid.y}`);

  // KV 캐시 확인 (force=1 이면 강제 갱신)
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
  const { date, ultraDate, ultraTime, vilageTime, tmxDate, tmxTime } = getKmaBaseDateTime();

  const [ncstRes, ultraFcstRes, vilageFcstRes, tmxFcstRes] = await Promise.allSettled([
    httpsGet(buildKmaUrl("getUltraSrtNcst", trimmedKey, ultraDate, ultraTime, grid, 100)),
    httpsGet(buildKmaUrl("getUltraSrtFcst", trimmedKey, ultraDate, ultraTime, grid, 200)),
    httpsGet(buildKmaUrl("getVilageFcst",   trimmedKey, date,      vilageTime, grid, 1000)),
    // 전날 23:00 발표 → 오늘 TMX(15:00)/TMN(06:00) 슬롯이 반드시 포함됨
    httpsGet(buildKmaUrl("getVilageFcst",   trimmedKey, tmxDate,   tmxTime,    grid, 300)),
  ]);

  try {
    const ncstItems      = await parseKmaResult(ncstRes,      "초단기실황");
    const ultraFcstItems = await parseKmaResult(ultraFcstRes, "초단기예보");
    const vilageFcstItems = await parseKmaResult(vilageFcstRes, "단기예보");
    // TMX/TMN 전용 — 실패해도 무시 (메인 예보에 영향 없음)
    const tmxFcstItems   = tmxFcstRes.status === "fulfilled"
      ? await parseKmaResult(tmxFcstRes, "TMX/TMN 보조예보").catch(() => [])
      : [];

    const current = buildCurrent(ncstItems, ultraFcstItems, vilageFcstItems, tmxFcstItems);
    const forecast = buildForecast(vilageFcstItems, ultraFcstItems);
    const data = { current, forecast };

    // KV에 저장 (최신 캐시 + 히스토리 스냅샷)
    if (process.env.KV_REST_API_URL) {
      try {
        const now = Date.now();
        // 최신 캐시
        await kv.set(cacheKey, { savedAt: now, data }, { ex: CACHE_TTL_SEC + 3600 });

        // 히스토리: 2시간 버킷 단위 키
        const bucket = Math.floor(now / (CACHE_TTL_SEC * 1000));
        const histKey = `kma:history:${grid.x}:${grid.y}:${bucket}`;
        await kv.set(histKey, { savedAt: now, data }, { ex: HISTORY_TTL_SEC });

        // 히스토리 인덱스 (최신 36개 버킷 목록)
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

// ── HTTPS 요청 (fetch 대신 내장 모듈 직접 사용) ───────────────────────────────

function httpsGet(urlStr) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WeatherApp/1.0)",
        "Accept": "application/json",
      },
    };
    const req = request(options, (r) => {
      let body = "";
      r.on("data", (chunk) => (body += chunk));
      r.on("end", () =>
        resolve({
          ok: r.statusCode >= 200 && r.statusCode < 300,
          status: r.statusCode,
          text: () => Promise.resolve(body),
          json: () => Promise.resolve(JSON.parse(body)),
        })
      );
    });
    req.on("error", reject);
    req.end();
  });
}

// ── KMA URL 빌더 ──────────────────────────────────────────────────────────────

function buildKmaUrl(endpoint, rawKey, baseDate, baseTime, grid, rows) {
  const params = new URLSearchParams({
    pageNo: "1",
    numOfRows: String(rows),
    dataType: "JSON",
    base_date: baseDate,
    base_time: baseTime,
    nx: String(grid.x),
    ny: String(grid.y),
  });
  return `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/${endpoint}?serviceKey=${rawKey}&${params.toString()}`;
}

// ── 응답 파싱 ─────────────────────────────────────────────────────────────────

async function parseKmaResult(result, label) {
  if (result.status !== "fulfilled") throw new Error(`${label} 요청 실패`);

  const res = result.value;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.log(`[KMA] ${label} ${res.status} body:`, body.slice(0, 300));
    throw new Error(`${label} HTTP ${res.status}`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`${label} 응답이 JSON이 아닙니다`);
  }

  const code = data?.response?.header?.resultCode;
  const msg = data?.response?.header?.resultMsg;
  if (code && code !== "00") throw new Error(`${label} 오류: ${msg || code}`);

  const raw = data?.response?.body?.items?.item;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

// ── 현재 날씨 빌드 ────────────────────────────────────────────────────────────

function buildCurrent(ncstItems, ultraFcstItems, vilageFcstItems, tmxFcstItems = []) {
  const nowMap = toMap(ncstItems, "category", "obsrValue");

  const ultraGroups = groupByDateTime(ultraFcstItems);
  const firstUltra = ultraGroups[0] ?? {};

  const villageGroups = groupByDateTime(vilageFcstItems);
  const firstVillage = villageGroups[0] ?? {};

  // ── 현재 기상 (초단기실황 T1H 우선) ────────────────────────────────
  const temp     = Number(nowMap.T1H  ?? firstUltra.T1H  ?? firstVillage.TMP ?? 0);
  const humidity = Number(nowMap.REH  ?? firstUltra.REH  ?? firstVillage.REH ?? 0);
  const wind     = Number(nowMap.WSD  ?? firstUltra.WSD  ?? firstVillage.WSD ?? 0);
  const sky = firstUltra.SKY ?? firstVillage.SKY;
  const pty = nowMap.PTY ?? firstUltra.PTY ?? firstVillage.PTY ?? "0";

  // ── 오늘 최고/최저 ────────────────────────────────────────────────
  // 우선순위: 전날 23:00 발표 TMX/TMN → 당일 발표 TMX/TMN → 오늘 TMP 범위
  const today = formatYMD(new Date(Date.now() + 9 * 60 * 60 * 1000));

  const allTodayItems = [...tmxFcstItems, ...vilageFcstItems]
    .filter((i) => i.fcstDate === today);

  const tmxItem = allTodayItems.find((i) => i.category === "TMX");
  const tmnItem = allTodayItems.find((i) => i.category === "TMN");

  const todayTmps = allTodayItems
    .filter((i) => i.category === "TMP")
    .map((i) => Number(i.fcstValue))
    .filter((v) => !isNaN(v));

  const high = tmxItem != null ? Number(tmxItem.fcstValue)
    : todayTmps.length > 0   ? Math.max(...todayTmps)
    : temp;
  const low  = tmnItem != null ? Number(tmnItem.fcstValue)
    : todayTmps.length > 0   ? Math.min(...todayTmps)
    : temp;

  // ── 관측 시각 ────────────────────────────────────────────────────
  const ncst0 = ncstItems[0];
  const observedAt = ncst0
    ? `${ncst0.baseTime.slice(0, 2)}:${ncst0.baseTime.slice(2, 4)} (기상청 실측)`
    : null;

  return {
    condition: getCondition(sky, pty),
    icon: getIcon(sky, pty),
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
  const base = vilageFcstItems.length ? vilageFcstItems : ultraFcstItems;
  const groups = groupByDateTime(base);

  // 날짜별 공식 TMN/TMX 먼저 수집
  const officialByDate = {};
  base.forEach((item) => {
    const d = item.fcstDate;
    if (!officialByDate[d]) officialByDate[d] = {};
    if (item.category === "TMN") officialByDate[d].TMN = Number(item.fcstValue);
    if (item.category === "TMX") officialByDate[d].TMX = Number(item.fcstValue);
  });

  return groups.slice(0, 60).map((g) => {
    const date = parseKmaDate(g.fcstDate, g.fcstTime);
    const official = officialByDate[g.fcstDate] ?? {};
    return {
      dateLabel: date.toLocaleDateString("ko-KR", {
        month: "numeric",
        day: "numeric",
        weekday: "short",
      }),
      timeLabel: `${g.fcstTime.slice(0, 2)}:${g.fcstTime.slice(2, 4)}`,
      condition: getCondition(g.SKY, g.PTY),
      icon: getIcon(g.SKY, g.PTY),
      temp: Number(g.TMP ?? g.T1H ?? 0),
      tempMin: official.TMN ?? Number(g.TMP ?? g.T1H ?? 0),
      tempMax: official.TMX ?? Number(g.TMP ?? g.T1H ?? 0),
      rainChance: Number(g.POP ?? 0),
    };
  });
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

function groupByDateTime(items) {
  const map = {};
  items.forEach((item) => {
    const key = `${item.fcstDate}-${item.fcstTime}`;
    if (!map[key]) map[key] = { fcstDate: item.fcstDate, fcstTime: item.fcstTime };
    map[key][item.category] = item.fcstValue;
  });
  return Object.values(map).sort((a, b) =>
    `${a.fcstDate}${a.fcstTime}`.localeCompare(`${b.fcstDate}${b.fcstTime}`)
  );
}

function toMap(items, keyField, valueField) {
  return items.reduce((acc, item) => {
    acc[item[keyField]] = item[valueField];
    return acc;
  }, {});
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
  return "날씨 정보";
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
  // Vercel 서버는 UTC 기준 → KST(UTC+9)로 변환
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);

  const ultra = new Date(now);
  if (ultra.getUTCMinutes() < 45) ultra.setUTCHours(ultra.getUTCHours() - 1);

  const village = new Date(now);
  const hhmm = village.getUTCHours() * 100 + village.getUTCMinutes();
  const baseTimes = [2300, 2000, 1700, 1400, 1100, 800, 500, 200];
  let selected = baseTimes.find((t) => hhmm >= t + 10);
  if (!selected) {
    village.setUTCDate(village.getUTCDate() - 1);
    selected = 2300;
  }

  // 오늘 TMX(15:00)/TMN(06:00) 확보용: 전날 23:00 발표 기준
  // → 해당 발표는 다음날 전체 슬롯(00~23시)을 포함하므로 TMX/TMN이 반드시 존재
  const prevDay = new Date(now);
  prevDay.setUTCDate(prevDay.getUTCDate() - 1);

  return {
    date: formatYMD(village),
    ultraDate: formatYMD(ultra),
    ultraTime: `${String(ultra.getUTCHours()).padStart(2, "0")}00`,
    vilageTime: String(selected).padStart(4, "0"),
    tmxDate: formatYMD(prevDay),   // 전날 날짜
    tmxTime: "2300",               // 전날 23:00 발표
  };
}

function formatYMD(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function parseKmaDate(date, time) {
  return new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(4, 6)) - 1,
    Number(date.slice(6, 8)),
    Number(time.slice(0, 2)),
    Number(time.slice(2, 4))
  );
}

