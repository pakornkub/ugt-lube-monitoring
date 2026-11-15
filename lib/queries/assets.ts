import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { dateOnly } from '@/lib/db/json';
import { siteWhere } from '@/lib/queries/permissions';
import type { Asset, AssetStatus, AssetType, Site } from '@/lib/types';

const DEFAULT_PAGE_SIZE = 20;

export interface SiteAgg {
  code: string;
  healthy: number;
  warning: number;
  critical: number;
  total: number;
  avgHealth: number;
}

export interface TypeAgg {
  type: string;
  abbr: string;
  color: string;
  healthy: number;
  warning: number;
  critical: number;
  total: number;
}

export interface DashboardKpis {
  total: number;
  critical: number;
  warning: number;
  healthy: number;
  avgHealth: number;
}

export interface DashboardData {
  kpis: DashboardKpis;
  perSite: SiteAgg[]; // ALL accessible — drives site pills
  siteReliability: SiteAgg[]; // SCOPED — drives the chart
  perType: TypeAgg[]; // SCOPED, sorted riskiest first
  topCritical: Asset[];
  scopedAssets: Asset[]; // SCOPED full list — consumed by exec-summary generation
}

export interface ReferenceData {
  sites: Site[];
  types: AssetType[];
  typeMap: Record<string, { abbr: string; color: string }>;
}

export const ASSET_SELECT = {
  id: true,
  name: true,
  type: true,
  site: true,
  health: true,
  status: true,
  install_date: true,
  motor_kw: true,
  rpm: true,
  vg_grade: true,
  oil_brand: true,
  oil_qty_l: true,
  oil_change_months: true,
  oil_sample_months: true,
  last_update: true,
} as const;

type AssetRow = Omit<Asset, 'install_date' | 'status'> & {
  install_date: Date | null;
  status: string;
};

/** A DB asset row → the app's Asset shape (DATE → 'YYYY-MM-DD'). */
export function toAsset(r: AssetRow): Asset {
  return { ...r, status: r.status as AssetStatus, install_date: dateOnly(r.install_date) };
}

async function readAssets(where: object): Promise<Asset[]> {
  const rows = await prisma.asset.findMany({ where, select: ASSET_SELECT, orderBy: { id: 'asc' } });
  return rows.map(toAsset);
}

export async function getReference(): Promise<ReferenceData> {
  const [sites, types]: [Site[], AssetType[]] = await Promise.all([
    prisma.site.findMany({
      select: { code: true, name: true, sort_order: true },
      orderBy: { sort_order: 'asc' },
    }),
    prisma.assetType.findMany({ select: { name: true, abbr: true, color: true } }),
  ]);
  const typeMap: ReferenceData['typeMap'] = {};
  for (const t of types) {
    typeMap[t.name] = { abbr: t.abbr ?? 'OT', color: t.color ?? '#94a3b8' };
  }
  return { sites, types, typeMap };
}

function bucketByStatus(assets: Asset[]) {
  let healthy = 0;
  let warning = 0;
  let critical = 0;
  let healthSum = 0;
  for (const a of assets) {
    healthSum += a.health;
    if (a.status === 'Critical') critical++;
    else if (a.status === 'Warning') warning++;
    else healthy++;
  }
  return {
    healthy,
    warning,
    critical,
    total: assets.length,
    avgHealth: assets.length ? Math.round((healthSum / assets.length) * 10) / 10 : 0,
  };
}

function aggregateBySite(assets: Asset[], codes: string[]): SiteAgg[] {
  return codes.map((code) => ({ code, ...bucketByStatus(assets.filter((a) => a.site === code)) }));
}

// All data the Dashboard needs in one plant-scoped pass.
// `scopeSite` = '' (global) | 'TSL' ... — an additional UI filter on top of the user's plant scope.
// `unscoped`: the cron's weekly digest (no user session) reads the whole fleet.
export async function getDashboardData(
  scopeSite: string,
  unscoped = false
): Promise<{
  data: DashboardData;
  reference: ReferenceData;
}> {
  const reference = await getReference();
  const all = await readAssets(unscoped ? {} : await siteWhere());
  const scoped = scopeSite ? all.filter((a) => a.site === scopeSite) : all;
  const siteCodes = reference.sites.map((s) => s.code);

  const kpis = bucketByStatus(scoped);

  // Per-type (scoped), sorted riskiest-first: most critical, then most warning.
  const perType: TypeAgg[] = reference.types
    .map((t) => ({
      type: t.name,
      abbr: t.abbr ?? 'OT',
      color: t.color ?? '#94a3b8',
      ...bucketByStatus(scoped.filter((a) => a.type === t.name)),
    }))
    .filter((t) => t.total > 0)
    .sort((a, b) => b.critical - a.critical || b.warning - a.warning);

  const topCritical = scoped
    .filter((a) => a.status === 'Critical' || a.status === 'Warning')
    .sort((a, b) => a.health - b.health)
    .slice(0, 10);

  return {
    data: {
      kpis,
      perSite: aggregateBySite(all, siteCodes),
      siteReliability: aggregateBySite(scoped, scopeSite ? [scopeSite] : siteCodes),
      perType,
      topCritical,
      scopedAssets: scoped,
    },
    reference,
  };
}

export interface AssetsListResult {
  rows: Asset[];
  total: number;
  page: number;
  pages: number;
}

export async function getAsset(id: string): Promise<Asset | null> {
  const r = await prisma.asset.findFirst({
    where: { id, ...(await siteWhere()) },
    select: ASSET_SELECT,
  });
  return r ? toAsset(r) : null;
}

export interface AssetOption {
  id: string;
  name: string;
  health: number;
  status: AssetStatus;
  site: string;
  type: string;
  vg_grade: number;
}

export async function getAssetOptions(): Promise<AssetOption[]> {
  const rows = await prisma.asset.findMany({
    where: await siteWhere(),
    select: {
      id: true,
      name: true,
      health: true,
      status: true,
      site: true,
      type: true,
      vg_grade: true,
    },
    orderBy: { id: 'asc' },
  });
  return rows.map((r) => ({ ...r, status: r.status as AssetStatus }));
}

export async function getAssetsList(opts: {
  site?: string;
  q?: string;
  status?: AssetStatus | '';
  sort?: '' | 'health_asc';
  page?: number;
  pageSize?: number;
}): Promise<AssetsListResult> {
  const PAGE_SIZE = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  const site = opts.site ?? '';
  const q = (opts.q ?? '').trim();
  const status = opts.status ?? '';
  const sort = opts.sort ?? '';
  const page = opts.page ?? 1;

  const scope = await siteWhere();
  // a plant outside the user's scope shows nothing (the scope's `in` must not be overwritten)
  if (site && scope.site && !scope.site.in.includes(site))
    return { rows: [], total: 0, page: 1, pages: 1 };
  const where = {
    ...scope,
    ...(site ? { site } : {}),
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ id: { contains: q } }, { name: { contains: q } }] } : {}),
  };
  const total = await prisma.asset.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const p = Math.min(Math.max(1, page), pages);
  const rows = await prisma.asset.findMany({
    where,
    select: ASSET_SELECT,
    // many machines share a score (100): without a tiebreak a row can repeat or vanish between pages
    orderBy: sort === 'health_asc' ? [{ health: 'asc' }, { id: 'asc' }] : [{ id: 'asc' }],
    skip: (p - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  return { rows: rows.map(toAsset), total, page: p, pages };
}

// The whole fleet (plant-scoped), read once per request: the Asset DB's site counts and
// data checks both need it.
export const getAllAssets = cache(async (): Promise<Asset[]> => readAssets(await siteWhere()));

export async function getSiteCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const a of await getAllAssets()) counts[a.site] = (counts[a.site] || 0) + 1;
  return counts;
}
