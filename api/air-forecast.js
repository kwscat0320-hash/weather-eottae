import { request } from "https";

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

function pm25ToGrade(val) {
  if (val <= 15) return "좋음";
  if (val <= 35) return "보통";
  if (val <= 75) return "나쁨";
  return "매우나쁨";
}

function pm10ToGrade(val) {
  if (val <= 30) return "좋음";
  if (val <= 80) return "보통";
  if (val <= 150) return "나쁨";
  return "매우나쁨";
}

// 위경도 → 에어코리아 예보 구역명
function getAirRegion(lat, lon) {
  if (lat >= 37.4 && lon >= 126.7 && lon <= 127.3) return "서울";
  if (lat >= 37.3 && lat < 37.6 && lon >= 126.4 && lon < 126.8) return "인천";
  if (lat >= 37.0 && lat < 37.6 && lon >= 126.8 && lon < 127.8) return "경기남부";
  if (lat >= 37.5 && lon >= 126.5 && lon < 127.8) return "경기북부";
  if (lat >= 37.0 && lon >= 128.0 && lon < 129.5 && lat < 38.5) return "강원영서";
  if (lat >= 37.0 && lon >= 129.0) return "강원영동";
  if (lat >= 36.0 && lat < 37.0 && lon >= 126.2 && lon < 127.5) return "충남";
  if (lat >= 36.0 && lat < 37.5 && lon >= 127.5 && lon < 128.5) return "충북";
  if (lat >= 35.5 && lat < 36.5 && lon >= 126.0 && lon < 127.5) return "전북";
  if (lat >= 34.0 && lat < 35.5 && lon < 127.5) return "전남";
  if (lat >= 35.5 && lat < 36.8 && lon >= 128.0 && lon < 129.5) return "경북";
  if (lat >= 34.8 && lat < 35.5 && lon >= 128.5 && lon < 129.5) return "부산";
  if (lat >= 34.8 && lat < 36.0 && lon >= 127.5 && lon < 129.0) return "경남";
  if (lat < 33.6) return "제주";
  return "서울";
}

function todayKST() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

function yesterdayKST() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  now.setUTCDate(now.getUTCDate() - 1);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

function toLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00+09:00");
  return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
}

function parseInformGrade(str, region) {
  const gradeMap = {};
  (str || "").split(",").forEach(part => {
    const idx = part.indexOf(":");
    if (idx === -1) return;
    const r = part.slice(0, idx).trim();
    const g = part.slice(idx + 1).trim();
    if (r && g) gradeMap[r] = g;
  });
  return gradeMap[region] || gradeMap["서울"] || null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "lat, lon 필요" });

  const kmaKey = process.env.KMA_KEY;
  const today     = todayKST();
  const yesterday = yesterdayKST();
  const region = getAirRegion(Number(lat), Number(lon));

  const [airkoreaYestRes, airkoreaTodayRes, meteoRes] = await Promise.allSettled([
    kmaKey
      ? httpsGetJson(`https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMinuDustFrcstDspth?serviceKey=${kmaKey.trim()}&returnType=json&numOfRows=50&pageNo=1&searchDate=${yesterday}&ver=1.1`)
      : Promise.reject("no KMA_KEY"),
    kmaKey
      ? httpsGetJson(`https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMinuDustFrcstDspth?serviceKey=${kmaKey.trim()}&returnType=json&numOfRows=50&pageNo=1&searchDate=${today}&ver=1.1`)
      : Promise.reject("no KMA_KEY"),
    httpsGetJson(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5,pm10&timezone=Asia%2FSeoul&forecast_days=5`),
  ]);

  // ── 에어코리아 (어제+오늘 발표 병합) ──────────────────────────────
  let airkorea = [];
  {
    const byDate = {};
    const todayStr = today;
    for (const result of [airkoreaYestRes, airkoreaTodayRes]) {
      if (result.status !== "fulfilled") continue;
      try {
        const items = result.value?.response?.body?.items || [];
        items.forEach(item => {
          const date = item.informData;
          if (!date) return;
          // D(오늘) 이후만 포함
          if (date <= todayStr) return;
          if (!byDate[date]) byDate[date] = {};
          const grade = parseInformGrade(item.informGrade, region);
          if (!grade) return;
          // 나중에 조회한 데이터(오늘 발표)가 더 최신 → 덮어쓰기 허용
          if (item.informCode === "PM25") byDate[date].pm25Grade = grade;
          if (item.informCode === "PM10") byDate[date].pm10Grade = grade;
        });
      } catch (e) {
        console.error("[air-forecast] airkorea parse error:", e.message);
      }
    }
    airkorea = Object.entries(byDate)
      .filter(([, v]) => v.pm25Grade || v.pm10Grade)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 3)
      .map(([date, grades]) => ({
        dateLabel: toLabel(date),
        pm25Grade: grades.pm25Grade || "보통",
        pm10Grade: grades.pm10Grade || "보통",
      }));
  }

  // ── OpenMeteo ─────────────────────────────────────────────────────
  let openmeteo = [];
  let openmeteoHourly = [];
  if (meteoRes.status === "fulfilled") {
    try {
      const hourly = meteoRes.value?.hourly;
      if (hourly?.time) {
        const byDate = {};
        hourly.time.forEach((t, i) => {
          const dateStr = t.slice(0, 10);
          if (!byDate[dateStr]) byDate[dateStr] = { pm25s: [], pm10s: [], hours: [] };
          if (hourly.pm2_5?.[i] != null) byDate[dateStr].pm25s.push(hourly.pm2_5[i]);
          if (hourly.pm10?.[i]  != null) byDate[dateStr].pm10s.push(hourly.pm10[i]);
          byDate[dateStr].hours.push({
            time: t.slice(11, 16),
            pm25: hourly.pm2_5?.[i] ?? null,
            pm10: hourly.pm10?.[i]  ?? null,
          });
        });

        // 오늘 시간대별
        if (byDate[today]) {
          openmeteoHourly = byDate[today].hours;
        }

        openmeteo = Object.entries(byDate)
          .sort(([a], [b]) => a.localeCompare(b))
          .filter(([date]) => date > today)
          .slice(0, 3)
          .map(([date, { pm25s, pm10s }]) => {
            const pm25 = pm25s.length ? pm25s.reduce((a, b) => a + b, 0) / pm25s.length : 0;
            const pm10 = pm10s.length ? pm10s.reduce((a, b) => a + b, 0) / pm10s.length : 0;
            return { dateLabel: toLabel(date), pm25Grade: pm25ToGrade(pm25), pm10Grade: pm10ToGrade(pm10), pm25: Math.round(pm25), pm10: Math.round(pm10) };
          });
      }
    } catch (e) {
      console.error("[air-forecast] openmeteo parse error:", e.message);
    }
  }

  return res.status(200).json({ airkorea, openmeteo, openmeteoHourly, region });
}
