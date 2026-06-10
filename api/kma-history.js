// GET /api/kma-history?lat=37.5&lon=126.9
// 최근 3일치 시간별 현재날씨 + 일별 예보 요약 반환

import { kv } from "@vercel/kv";
import { dfsXyConv } from "./_kma-utils.js";

/**
 * forecast 배열(시간별) → 일별 요약 배열
 * WeatherContext의 dailyForecasts와 동일한 로직
 */
function buildDailySummary(forecast = []) {
  if (!forecast.length) return [];
  const grouped = {};
  forecast.forEach((item) => {
    const key = item.dateLabel;
    if (!key) return;
    if (!grouped[key]) {
      grouped[key] = {
        dateLabel: key,
        min:        item.tempMin ?? null,
        max:        item.tempMax ?? null,
        rainChance: item.rainChance ?? 0,
        tmps:       [],
      };
    }
    const g = grouped[key];
    if (item.tempMin != null) g.min = g.min == null ? item.tempMin : Math.min(g.min, item.tempMin);
    if (item.tempMax != null) g.max = g.max == null ? item.tempMax : Math.max(g.max, item.tempMax);
    g.rainChance = Math.max(g.rainChance, item.rainChance ?? 0);
    if (item.temp != null) g.tmps.push(item.temp);
  });

  return Object.values(grouped).map(({ tmps, ...rest }) => ({
    ...rest,
    min: rest.min ?? (tmps.length ? Math.min(...tmps) : null),
    max: rest.max ?? (tmps.length ? Math.max(...tmps) : null),
  }));
}

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
        if (!snap) return null;
        return {
          savedAt:      snap.savedAt,
          current:      snap.data?.current ?? null,
          dailySummary: buildDailySummary(snap.data?.forecast ?? []),
        };
      })
    );
    return res.status(200).json(snapshots.filter(Boolean));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
