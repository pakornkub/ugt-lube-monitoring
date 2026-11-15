import { prisma } from '@/lib/prisma';
import { siteWhere } from '@/lib/queries/permissions';
import type { AlarmParam, AssetAlarmOverride, AssetScoreOverride, ScoreConfig } from '@/lib/types';

export interface AlarmConfig {
  params: AlarmParam[];
  scoreConfig: ScoreConfig;
}

export interface AssetAlarmConfig extends AlarmConfig {
  hasOverride: boolean;
}

const DEFAULT_SCORE: ScoreConfig = {
  oil_weight: 100,
  vib_weight: 0,
  warn_penalty: 15,
  crit_penalty: 30,
};
const CHUNK = 1000; // SQL Server: 2100 parameters per statement

export async function getAlarmConfig(): Promise<AlarmConfig> {
  const [params, cfg] = await Promise.all([
    prisma.alarmParam.findMany({
      select: {
        id: true,
        category: true,
        key: true,
        name: true,
        unit: true,
        description: true,
        warn_limit: true,
        crit_limit: true,
        warn_penalty: true,
        crit_penalty: true,
      },
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    }),
    prisma.scoreConfig.findUnique({
      where: { id: 1 },
      select: { oil_weight: true, vib_weight: true, warn_penalty: true, crit_penalty: true },
    }),
  ]);
  return {
    params: params.map((p) => ({ ...p, category: p.category as AlarmParam['category'] })),
    scoreConfig: cfg ?? DEFAULT_SCORE,
  };
}

// `unscoped`: the cron's digest (no user session); otherwise overrides follow the user's plant scope.
async function overrideWhere(assetIds: string[], unscoped: boolean) {
  return { asset_id: { in: assetIds }, ...(unscoped ? {} : { asset: await siteWhere() }) };
}

/** Effective (merged) alarm config for one asset — global config with any
 * asset-level overrides applied on top, param-by-param / field-by-field. */
// `base`: the global config, when the caller already loaded it for many assets.
export async function getAssetAlarmConfig(
  assetId: string,
  base?: AlarmConfig,
  unscoped = false
): Promise<AssetAlarmConfig> {
  const cfg = base ?? (await getAlarmConfig());
  return (await getAssetAlarmConfigs([assetId], cfg, unscoped)).get(assetId)!;
}

/** getAssetAlarmConfig for many assets: two queries per chunk, not two per asset. */
export async function getAssetAlarmConfigs(
  assetIds: string[],
  base: AlarmConfig,
  unscoped = false
): Promise<Map<string, AssetAlarmConfig>> {
  const out = new Map<string, AssetAlarmConfig>();
  const params: AssetAlarmOverride[] = [];
  const scores: AssetScoreOverride[] = [];
  for (let i = 0; i < assetIds.length; i += CHUNK) {
    const where = await overrideWhere(assetIds.slice(i, i + CHUNK), unscoped);
    const [p, s] = await Promise.all([
      prisma.assetAlarmOverride.findMany({ where }),
      prisma.assetScoreOverride.findMany({ where }),
    ]);
    params.push(
      ...p.map((o) => ({ ...o, category: o.category as AssetAlarmOverride['category'] }))
    );
    scores.push(...s);
  }
  for (const id of assetIds) {
    out.set(
      id,
      mergeAssetConfig(
        base,
        params.filter((o) => o.asset_id === id),
        scores.find((o) => o.asset_id === id) ?? null
      )
    );
  }
  return out;
}

function mergeAssetConfig(
  { params, scoreConfig }: AlarmConfig,
  paramOverrides: AssetAlarmOverride[],
  scoreOverride: AssetScoreOverride | null
): AssetAlarmConfig {
  const mergedParams = params.map((p) => {
    const ov = paramOverrides.find((o) => o.category === p.category && o.key === p.key);
    if (!ov) return p;
    return {
      ...p,
      warn_limit: ov.warn_limit ?? p.warn_limit,
      crit_limit: ov.crit_limit ?? p.crit_limit,
      warn_penalty: ov.warn_penalty ?? p.warn_penalty,
      crit_penalty: ov.crit_penalty ?? p.crit_penalty,
    };
  });

  const mergedScore: ScoreConfig = scoreOverride
    ? {
        oil_weight: scoreOverride.oil_weight ?? scoreConfig.oil_weight,
        vib_weight: scoreOverride.vib_weight ?? scoreConfig.vib_weight,
        warn_penalty: scoreOverride.warn_penalty ?? scoreConfig.warn_penalty,
        crit_penalty: scoreOverride.crit_penalty ?? scoreConfig.crit_penalty,
      }
    : scoreConfig;

  return {
    params: mergedParams,
    scoreConfig: mergedScore,
    hasOverride: paramOverrides.length > 0 || !!scoreOverride,
  };
}
