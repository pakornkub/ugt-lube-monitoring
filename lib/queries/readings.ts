import { prisma } from '@/lib/prisma';
import { siteWhere } from '@/lib/queries/permissions';
import type { OilReading, VibReading } from '@/lib/types';

export const OIL_SELECT = {
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
export const VIB_SELECT = { period: true, vel: true, acc: true, cf: true, temp: true } as const;

// SQL Server allows 2100 parameters per statement — id lists are read in chunks well under it.
const CHUNK = 1000;

// `unscoped`: the cron's digest (no user session); otherwise the user's plant scope applies.
async function scope(unscoped: boolean) {
  return unscoped ? {} : { asset: await siteWhere() };
}

// Latest readings for an asset.
export async function getLatestReadings(
  assetId: string,
  unscoped = false
): Promise<{
  oil: OilReading | null;
  vib: VibReading | null;
}> {
  const where = { asset_id: assetId, ...(await scope(unscoped)) };
  const [oil, vib] = await Promise.all([
    prisma.oilReading.findFirst({ where, select: OIL_SELECT, orderBy: { period: 'desc' } }),
    prisma.vibReading.findFirst({ where, select: VIB_SELECT, orderBy: { period: 'desc' } }),
  ]);
  return { oil, vib };
}

/** getLatestReadings for many assets in a few queries. */
export async function getLatestReadingsMany(
  assetIds: string[],
  unscoped = false
): Promise<Map<string, { oil: OilReading | null; vib: VibReading | null }>> {
  const out = new Map<string, { oil: OilReading | null; vib: VibReading | null }>();
  for (const id of assetIds) out.set(id, { oil: null, vib: null });
  const sc = await scope(unscoped);
  for (let i = 0; i < assetIds.length; i += CHUNK) {
    const where = { asset_id: { in: assetIds.slice(i, i + CHUNK) }, ...sc };
    // shortcut: reads each machine's whole history and keeps the newest — fine for monthly results
    // on ~600 machines; switch to a groupBy(max period) when the history grows to years × thousands.
    const [oil, vib] = await Promise.all([
      prisma.oilReading.findMany({
        where,
        select: { asset_id: true, ...OIL_SELECT },
        orderBy: { period: 'desc' },
      }),
      prisma.vibReading.findMany({
        where,
        select: { asset_id: true, ...VIB_SELECT },
        orderBy: { period: 'desc' },
      }),
    ]);
    // newest first: the first row seen for an asset is its latest
    for (const { asset_id, ...r } of oil) {
      const cur = out.get(asset_id);
      if (cur && !cur.oil) cur.oil = r;
    }
    for (const { asset_id, ...r } of vib) {
      const cur = out.get(asset_id);
      if (cur && !cur.vib) cur.vib = r;
    }
  }
  return out;
}

/**
 * Each machine's latest lab (oil) period, or no entry when it has none yet. assets.last_update
 * is not this: it holds the month the machine was added and saving a reading never moves it.
 */
export async function getLatestLabPeriods(
  assetIds: string[],
  unscoped = false
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const sc = await scope(unscoped);
  for (let i = 0; i < assetIds.length; i += CHUNK) {
    const rows = await prisma.oilReading.groupBy({
      by: ['asset_id'],
      where: { asset_id: { in: assetIds.slice(i, i + CHUNK) }, ...sc },
      _max: { period: true },
    });
    for (const r of rows) if (r._max.period) out[r.asset_id] = r._max.period;
  }
  return out;
}

// Full readings history (asc by period) for trend charts.
export async function getReadingsHistory(assetId: string): Promise<{
  oil: OilReading[];
  vib: VibReading[];
}> {
  const where = { asset_id: assetId, ...(await scope(false)) };
  const [oil, vib] = await Promise.all([
    prisma.oilReading.findMany({ where, select: OIL_SELECT, orderBy: { period: 'asc' } }),
    prisma.vibReading.findMany({ where, select: VIB_SELECT, orderBy: { period: 'asc' } }),
  ]);
  return { oil, vib };
}
