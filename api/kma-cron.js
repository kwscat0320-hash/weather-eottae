// Vercel Cron — 2시간마다 주요 좌표 KMA 캐시 갱신
// 호출: GET /api/kma-cron  (Vercel이 스케줄에 따라 자동 실행)

const TARGETS = [
  { name: "서울",   lat: 37.5665, lon: 126.9780 },
  { name: "부산",   lat: 35.1796, lon: 129.0756 },
  { name: "대구",   lat: 35.8714, lon: 128.6014 },
  { name: "인천",   lat: 37.4563, lon: 126.7052 },
  { name: "광주",   lat: 35.1595, lon: 126.8526 },
  { name: "대전",   lat: 36.3504, lon: 127.3845 },
];

export default async function handler(req, res) {
  // Vercel Cron 요청 검증
  const authHeader = req.headers["authorization"];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const baseUrl = `https://${req.headers.host}`;
  const results = [];

  for (const t of TARGETS) {
    try {
      const r = await fetch(`${baseUrl}/api/kma?lat=${t.lat}&lon=${t.lon}&force=1`);
      results.push({ name: t.name, status: r.status, ok: r.ok });
    } catch (e) {
      results.push({ name: t.name, status: 0, ok: false, error: e.message });
    }
  }

  const failed = results.filter(r => !r.ok);
  console.log("[kma-cron] results:", JSON.stringify(results));

  return res.status(200).json({
    timestamp: new Date().toISOString(),
    refreshed: results.length - failed.length,
    failed: failed.length,
    results,
  });
}
