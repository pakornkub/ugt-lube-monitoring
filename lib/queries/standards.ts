import { prisma } from '@/lib/prisma';
import { parseList } from '@/lib/db/json';
import type { Standard, StandardCategory } from '@/lib/types';

type Row = Awaited<ReturnType<typeof prisma.standard.findFirstOrThrow>>;

function toStandard(r: Row): Standard {
  return {
    id: r.id,
    category: r.category as StandardCategory,
    title: r.title,
    subtitle: r.subtitle,
    description: r.description,
    full_text: r.full_text,
    tags: parseList(r.tags),
    version: r.version,
    updated_at: r.updated_at.toISOString(),
    updated_by: r.updated_by,
    related_params: parseList(r.related_params),
    asset_types: parseList(r.asset_types),
    related_standard_ids: parseList(r.related_standard_ids),
  };
}

async function all(category?: StandardCategory | ''): Promise<Standard[]> {
  const rows = await prisma.standard.findMany({
    where: category ? { category } : {},
    orderBy: { title: 'asc' },
  });
  return rows.map(toStandard);
}

export async function listStandards(opts: {
  category?: StandardCategory | '';
  q?: string;
}): Promise<Standard[]> {
  const q = (opts.q ?? '').trim().toLowerCase();
  const rows = await all(opts.category);
  if (!q) return rows;
  return rows.filter((s) => {
    const hay =
      `${s.title} ${s.subtitle ?? ''} ${s.description ?? ''} ${(s.tags ?? []).join(' ')}`.toLowerCase();
    return hay.includes(q);
  });
}

export async function getStandard(id: string): Promise<Standard | null> {
  const r = await prisma.standard.findUnique({ where: { id } });
  return r ? toStandard(r) : null;
}

// Standards whose related_params overlap any of `paramKeys`, plus standards that
// apply to `assetType`. Used by drill-down / alarm config to link references.
// No keys = every standard (as the Supabase query did — no filter applied).
// shortcut: filters the (small, ~20-row) library in memory; move to SQL if it grows to thousands.
export async function listStandardsRelated(
  paramKeys: string[],
  assetType?: string
): Promise<Standard[]> {
  const keys = paramKeys.filter(Boolean);
  const rows = await all();
  if (!keys.length) return rows;
  return rows.filter(
    (s) =>
      (s.related_params ?? []).some((k) => keys.includes(k)) ||
      (!!assetType && (s.asset_types ?? []).includes(assetType))
  );
}

// Map of param key -> related standards (for the Alarm Config page).
export async function getStandardsByParam(
  paramKeys: string[]
): Promise<Record<string, Standard[]>> {
  const related = await listStandardsRelated(paramKeys);
  const map: Record<string, Standard[]> = {};
  for (const s of related) {
    for (const k of s.related_params ?? []) {
      (map[k] ??= []).push(s);
    }
  }
  return map;
}
