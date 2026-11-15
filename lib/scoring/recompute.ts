import 'server-only';
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

async function scoreAsset(
  assetId: string,
  g: { params: AlarmParam[]; cfg: ScoreConfig }
): Promise<number | null> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
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
    },
  });
  if (!asset) return null;

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
  return getDeductionBreakdown(oil, vib, params, cfg, asset.vg_grade).netScore;
}

async function store(assetId: string, health: number): Promise<void> {
  await prisma.asset.update({
    where: { id: assetId },
    data: { health, status: statusFromHealth(health) },
  });
}

/** Recompute one machine's Health Score and cache it on the asset row. */
export async function computeHealth(assetId: string): Promise<void> {
  const health = await scoreAsset(assetId, await loadGlobals());
  if (health != null) await store(assetId, health);
}

/** Recompute every machine (after thresholds / score_config change). */
export async function recomputeAllHealth(): Promise<void> {
  const g = await loadGlobals();
  const ids = await prisma.asset.findMany({ select: { id: true, health: true } });
  for (const { id, health: old } of ids) {
    const health = await scoreAsset(id, g);
    if (health != null && health !== old) await store(id, health);
  }
}
