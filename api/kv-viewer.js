// GET /api/kv-viewer?secret=YOUR_CRON_SECRET
// GET /api/kv-viewer?secret=...&lat=37.5665&lon=126.978   (특정 좌표)
// GET /api/kv-viewer?secret=...&key=kma:index:60:127      (직접 키 지정)

import { kv } from "@vercel/kv";
import { dfsXyConv } from "./_kma-utils.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (!process.env.KV_REST_API_URL) {
    return res.status(503).json({ error: "KV_REST_API_URL 환경변수가 없습니다. Vercel 대시보드에서 KV 스토어를 연결해주세요." });
  }

  try {
    const { lat, lon, key: directKey } = req.query;

    // ── 직접 키 조회 ─────────────────────────────────────────────────
    if (directKey) {
      const value = await kv.get(directKey);
      return res.status(200).json({ key: directKey, value });
    }

    // ── 좌표 기반 조회 ───────────────────────────────────────────────
    if (lat && lon) {
      const grid = dfsXyConv(Number(lat), Number(lon));
      const latestKey = `kma:latest:v2:${grid.x}:${grid.y}`;
      const latest = await kv.get(latestKey);

      if (!latest) {
        return res.status(200).json({ error: "캐시 없음 — 앱을 한 번 열면 캐시가 생성됩니다.", grid });
      }

      // 날짜별 TMX/TMN 요약
      const byDate = {};
      (latest.data?.forecast || []).forEach(f => {
        const d = f.dateLabel;
        if (!byDate[d]) byDate[d] = { date: d, tmps: [], officialTMX: null, officialTMN: null };
        if (f.temp != null) byDate[d].tmps.push(f.temp);
        if (f.officialTMX != null) byDate[d].officialTMX = f.officialTMX;
        if (f.officialTMN != null) byDate[d].officialTMN = f.officialTMN;
      });

      const dailySummary = Object.values(byDate).map(d => ({
        date: d.date,
        officialTMX: d.officialTMX,
        officialTMN: d.officialTMN,
        tmpMax: d.tmps.length ? Math.max(...d.tmps) : null,
        tmpMin: d.tmps.length ? Math.min(...d.tmps) : null,
        slotCount: d.tmps.length,
      }));

      return res.status(200).json({
        grid,
        cachedAt: new Date(latest.savedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
        dailySummary,
      });
    }

    // ── 전체 인덱스 목록 ─────────────────────────────────────────────
    const keys = await kv.keys("kma:index:*");
    const summary = await Promise.all(
      keys.map(async (k) => {
        const buckets = await kv.get(k);
        return { key: k, snapshotCount: Array.isArray(buckets) ? buckets.length : 0 };
      })
    );

    return res.status(200).json({
      totalLocations: keys.length,
      locations: summary,
      usage: {
        byCoord: "/api/kv-viewer?secret=...&lat=37.5665&lon=126.978",
        byKey:   "/api/kv-viewer?secret=...&key=kma:index:60:127",
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
