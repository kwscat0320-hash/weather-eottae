// Vercel 서버리스 프록시 — 브라우저 CORS 우회용

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: "lat, lon 파라미터가 필요합니다." });
  }

  const rawKey = process.env.KMA_KEY;
  if (!rawKey) {
    return res.status(500).json({ error: "KMA_KEY 환경변수가 설정되지 않았습니다." });
  }

  // 키가 이미 percent-encoded 상태면 그대로, 아니면 인코딩
  const key = rawKey.includes("%") ? rawKey : encodeURIComponent(rawKey);

  const grid = dfsXyConv(Number(lat), Number(lon));
  const { date, ultraDate, ultraTime, vilageTime } = getKmaBaseDateTime();

  console.log("[KMA] rawKey prefix:", rawKey.slice(0, 12));
  console.log("[KMA] encodedKey prefix:", key.slice(0, 12));
  console.log("[KMA] grid:", JSON.stringify(grid));
  console.log("[KMA] baseDate:", date, "ultraDate:", ultraDate, "ultraTime:", ultraTime);

  const [ncstRes, ultraFcstRes, vilageFcstRes] = await Promise.allSettled([
    fetch(buildKmaUrl("getUltraSrtNcst", key, ultraDate, ultraTime, grid, 100)),
    fetch(buildKmaUrl("getUltraSrtFcst", key, ultraDate, ultraTime, grid, 200)),
    fetch(buildKmaUrl("getVilageFcst", key, date, vilageTime, grid, 1000)),
  ]);

  console.log("[KMA] ncst HTTP:", ncstRes.value?.status);
  console.log("[KMA] ultraFcst HTTP:", ultraFcstRes.value?.status);
  console.log("[KMA] vilageFcst HTTP:", vilageFcstRes.value?.status);

  try {
    const ncstItems = await parseKmaResult(ncstRes, "초단기실황");
    const ultraFcstItems = await parseKmaResult(ultraFcstRes, "초단기예보");
    const vilageFcstItems = await parseKmaResult(vilageFcstRes, "단기예보");

    const current = buildCurrent(ncstItems, ultraFcstItems, vilageFcstItems);
    const forecast = buildForecast(vilageFcstItems, ultraFcstItems);

    return res.status(200).json({ current, forecast });
  } catch (err) {
    console.error("[KMA] error:", err.message);
    return res.status(502).json({ error: err.message });
  }
}

// ── KMA URL 빌더 ──────────────────────────────────────────────────────────────

function buildKmaUrl(endpoint, key, baseDate, baseTime, grid, rows) {
  return (
    `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/${endpoint}` +
    `?serviceKey=${encodeURIComponent(key)}` +
    `&pageNo=1&numOfRows=${rows}&dataType=JSON` +
    `&base_date=${baseDate}&base_time=${baseTime}` +
    `&nx=${grid.x}&ny=${grid.y}`
  );
}

// ── 응답 파싱 ─────────────────────────────────────────────────────────────────

async function parseKmaResult(result, label) {
  if (result.status !== "fulfilled") throw new Error(`${label} 요청 실패`);

  const res = result.value;
  if (!res.ok) throw new Error(`${label} HTTP ${res.status}`);

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

function buildCurrent(ncstItems, ultraFcstItems, vilageFcstItems) {
  const nowMap = toMap(ncstItems, "category", "obsrValue");

  const ultraGroups = groupByDateTime(ultraFcstItems);
  const firstUltra = ultraGroups[0] ?? {};

  const villageGroups = groupByDateTime(vilageFcstItems);
  const firstVillage = villageGroups[0] ?? {};

  const today = formatYMD(new Date());
  const todayVillage = vilageFcstItems.filter((i) => i.fcstDate === today);
  const tmx = todayVillage.find((i) => i.category === "TMX")?.fcstValue;
  const tmn = todayVillage.find((i) => i.category === "TMN")?.fcstValue;

  const temp = Number(nowMap.T1H ?? firstUltra.T1H ?? firstVillage.TMP ?? 0);
  const humidity = Number(nowMap.REH ?? firstUltra.REH ?? firstVillage.REH ?? 0);
  const wind = Number(nowMap.WSD ?? firstUltra.WSD ?? firstVillage.WSD ?? 0);
  const sky = firstUltra.SKY ?? firstVillage.SKY;
  const pty = nowMap.PTY ?? firstUltra.PTY ?? firstVillage.PTY ?? "0";

  return {
    condition: getCondition(sky, pty),
    icon: getIcon(sky, pty),
    temp,
    feelsLike: calcFeelsLike(temp, wind),
    high: Number(tmx ?? firstVillage.TMP ?? temp),
    low: Number(tmn ?? firstVillage.TMP ?? temp),
    rainChance: Number(firstUltra.POP ?? firstVillage.POP ?? 0),
    humidity,
    wind,
  };
}

// ── 예보 빌드 ─────────────────────────────────────────────────────────────────

function buildForecast(vilageFcstItems, ultraFcstItems) {
  const base = ultraFcstItems.length ? ultraFcstItems : vilageFcstItems;
  const groups = groupByDateTime(base);

  return groups.slice(0, 40).map((g) => {
    const date = parseKmaDate(g.fcstDate, g.fcstTime);
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
      tempMin: Number(g.TMN ?? g.TMP ?? g.T1H ?? 0),
      tempMax: Number(g.TMX ?? g.TMP ?? g.T1H ?? 0),
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
  const now = new Date();

  const ultra = new Date(now);
  if (ultra.getMinutes() < 45) ultra.setHours(ultra.getHours() - 1);

  const village = new Date(now);
  const hhmm = village.getHours() * 100 + village.getMinutes();
  const baseTimes = [2300, 2000, 1700, 1400, 1100, 800, 500, 200];
  let selected = baseTimes.find((t) => hhmm >= t + 10);
  if (!selected) {
    village.setDate(village.getDate() - 1);
    selected = 2300;
  }

  return {
    date: formatYMD(village),
    ultraDate: formatYMD(ultra),
    ultraTime: `${String(ultra.getHours()).padStart(2, "0")}00`,
    vilageTime: String(selected).padStart(4, "0"),
  };
}

function formatYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
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

function dfsXyConv(lat, lon) {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0;
  const OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD, olat = OLAT * DEGRAD;

  let sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) /
    Math.log(Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5));
  let sf = (Math.pow(Math.tan(Math.PI * 0.25 + slat1 * 0.5), sn) * Math.cos(slat1)) / sn;
  let ro = (re * sf) / Math.pow(Math.tan(Math.PI * 0.25 + olat * 0.5), sn);

  let ra = (re * sf) / Math.pow(Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5), sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  return {
    x: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    y: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}
