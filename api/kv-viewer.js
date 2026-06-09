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
      const idxKey = `kma:index:${grid.x}:${grid.y}`;
      const latestKey = `kma:latest:${grid.x}:${grid.y}`;

      const [buckets, latest] = await Promise.all([
        kv.get(idxKey),
        kv.get(latestKey),
      ]);

      const snapshots = buckets
        ? await Promise.all(
            (buckets).map(async (bucket) => {
              const snap = await kv.get(`kma:history:${grid.x}:${grid.y}:${bucket}`);
              if (!snap) return null;
              return {
                bucket,
                savedAt: new Date(snap.savedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
                temp: snap.data?.current?.temp,
                condition: snap.data?.current?.condition,
                humidity: snap.data?.current?.humidity,
                wind: snap.data?.current?.wind,
              };
            })
          )
        : [];

      return res.status(200).json({
        grid,
        latestCachedAt: latest ? new Date(latest.savedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : null,
        snapshotCount: snapshots.filter(Boolean).length,
        snapshots: snapshots.filter(Boolean),
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
