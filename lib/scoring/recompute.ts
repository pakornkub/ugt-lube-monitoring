import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getDeductionBreakdown } from '@/lib/scoring/audit';
import { statusFromHealth } from '@/lib/scoring/health';
import type { AlarmParam, OilReading, ScoreConfig, VibReading } from '@/lib/types';

// THE Health Score writer (iron rule, AGENTS.md). Replaces the Supabase
// compute_health() trigger: SQL Server has no copy of the formula, so the one
// formula is getDeductionBreakdown() (lib/scoring/audit.ts), run here on the
// server and cached on assets.health/status. Every write that can change a score
// calls one of these after it commits: oil/vib reading save or delete, an asset's
// VG grade or overrides, thresholds/score_config (recomputeAllHealth).

const OIL_SELECT = {
  period: true,
  fe: true,
  cu: true,
  si: true,
  water: true,
  visc: true,
  tan: true,
  iso_code: true,
  particle_4: true,
  particle_6: true,
  particle_14: true,
} as const;
const VIB_SELECT = { period: true, vel: true, acc: true, cf: true, temp: true } as const;

async function loadGlobals(): Promise<{ params: AlarmParam[]; cfg: ScoreConfig }> {
  const [params, cfg] = await Promise.all([
    prisma.alarmParam.findMany(),
    prisma.scoreConfig.findUnique({ where: { id: 1 } }),
  ]);
  return {
    params: params.map((p) => ({ ...p, category: p.category as AlarmParam['category'] })),
    cfg: cfg ?? { oil_weight: 100, vib_weight: 0, warn_penalty: 15, crit_penalty: 30 },
  };
}

// Everything the formula needs for one machine — one shape for the single and the bulk path.
const ASSET_SCORE_SELECT = {
  id: true,
  health: true,
  last_update: true,
  vg_grade: true,
  alarmOverrides: true,
  scoreOverride: true,
  // latest = newest period, then newest row (same order compute_health used)
  oil_readings: {
    select: OIL_SELECT,
    orderBy: [{ period: 'desc' }, { created_at: 'desc' }],
    take: 1,
  },
  vib_readings: {
    select: VIB_SELECT,
    orderBy: [{ period: 'desc' }, { created_at: 'desc' }],
    take: 1,
  },
} satisfies Prisma.assetSelect;

type ScoreRow = NonNullable<Awaited<ReturnType<typeof loadRow>>>;
type Scored = { health: number; lastUpdate: string | null };

function loadRow(assetId: string) {
  return prisma.asset.findUnique({ where: { id: assetId }, select: ASSET_SCORE_SELECT });
}

function scoreRow(asset: ScoreRow, g: { params: AlarmParam[]; cfg: ScoreConfig }): Scored {
  const params = asset.alarmOverrides.length
    ? g.params.map((p) => {
        const ov = asset.alarmOverrides.find((o) => o.category === p.category && o.key === p.key);
        return ov
          ? {
              ...p,
              warn_limit: ov.warn_limit ?? p.warn_limit,
              crit_limit: ov.crit_limit ?? p.crit_limit,
              warn_penalty: ov.warn_penalty ?? p.warn_penalty,
              crit_penalty: ov.crit_penalty ?? p.crit_penalty,
            }
          : p;
      })
    : g.params;
  const so = asset.scoreOverride;
  const cfg: ScoreConfig = so
    ? {
        oil_weight: so.oil_weight ?? g.cfg.oil_weight,
        vib_weight: so.vib_weight ?? g.cfg.vib_weight,
        warn_penalty: so.warn_penalty ?? g.cfg.warn_penalty,
        crit_penalty: so.crit_penalty ?? g.cfg.crit_penalty,
      }
    : g.cfg;

  const oil = (asset.oil_readings[0] ?? null) as OilReading | null;
  const vib = (asset.vib_readings[0] ?? null) as VibReading | null;
  const health = getDeductionBreakdown(oil, vib, params, cfg, asset.vg_grade).netScore;
  // "Last update" only moves forward: a newer reading advances it, deleting one never
  // pulls it back below the equipment list's own date (what the app always showed).
  const lastUpdate =
    [asset.last_update, oil?.period, vib?.period]
      .filter((p): p is string => !!p)
      .sort()
      .pop() ?? null;
  return { health, lastUpdate };
}

/** Recompute one machine's Health Score and cache it on the asset row. */
export async function computeHealth(assetId: string): Promise<void> {
  const row = await loadRow(assetId);
  if (!row) return;
  const r = scoreRow(row, await loadGlobals());
  await prisma.asset.update({
    where: { id: assetId },
    data: { health: r.health, status: statusFromHealth(r.health), last_update: r.lastUpdate },
  });
}

/** Recompute every machine (after thresholds / score_config change): one read for the
 *  fleet, then one updateMany per distinct score — a handful of round trips, not ~3 per machine. */
export async function recomputeAllHealth(): Promise<void> {
  const g = await loadGlobals();
  const rows = await prisma.asset.findMany({ select: ASSET_SCORE_SELECT });
  const byHealth = new Map<number, string[]>();
  const moved: { id: string; lastUpdate: string | null }[] = [];
  for (const row of rows) {
    const r = scoreRow(row, g);
    if (r.health !== row.health)
      byHealth.set(r.health, [...(byHealth.get(r.health) ?? []), row.id]);
    if (r.lastUpdate !== row.last_update) moved.push({ id: row.id, lastUpdate: r.lastUpdate });
  }
  const CHUNK = 1000; // SQL Server allows 2100 parameters per statement
  for (const [health, ids] of byHealth) {
    for (let i = 0; i < ids.length; i += CHUNK) {
      await prisma.asset.updateMany({
        where: { id: { in: ids.slice(i, i + CHUNK) } },
        data: { health, status: statusFromHealth(health) },
      });
    }
  }
  for (const m of moved) {
    await prisma.asset.update({ where: { id: m.id }, data: { last_update: m.lastUpdate } });
  }
}
