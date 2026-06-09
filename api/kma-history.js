// GET /api/kma-history?lat=37.5&lon=126.9
// 최근 3일치 2시간 단위 스냅샷 반환

import { kv } from "@vercel/kv";
import { dfsXyConv } from "./_kma-utils.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "lat, lon 필요" });
  if (!process.env.KV_REST_API_URL) return res.status(503).json({ error: "KV 미설정" });

  const grid = dfsXyConv(Number(lat), Number(lon));
  const idxKey = `kma:index:${grid.x}:${grid.y}`;

  try {
    const buckets = (await kv.get(idxKey)) || [];
    const snapshots = await Promise.all(
      buckets.map(async (bucket) => {
        const snap = await kv.get(`kma:history:${grid.x}:${grid.y}:${bucket}`);
        return snap ? { savedAt: snap.savedAt, current: snap.data?.current } : null;
      })
    );
    return res.status(200).json(snapshots.filter(Boolean));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
