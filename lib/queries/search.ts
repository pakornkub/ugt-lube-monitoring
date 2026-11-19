import { prisma } from '@/lib/prisma';
import { siteWhere } from '@/lib/queries/permissions';

export interface SearchResult {
  type: 'asset' | 'standard';
  id: string;
  title: string;
  subtitle: string;
  href: string;
  health?: number;
}

export async function globalSearch(q: string): Promise<SearchResult[]> {
  const query = q.trim().toLowerCase().slice(0, 100);
  if (!query) return [];

  // `contains` is a parameterized LIKE: ( ) , in IDs like "31-A02 (Gear Box)" are plain text.
  const rows = await prisma.asset.findMany({
    where: {
      ...(await siteWhere()),
      OR: [{ id: { contains: query } }, { name: { contains: query } }],
    },
    select: { id: true, name: true, type: true, site: true, health: true },
    take: 8,
  });
  return rows.map((a) => ({
    type: 'asset',
    id: a.id,
    title: a.name,
    subtitle: `${a.id} · ${a.type} · ${a.site} · Health ${a.health}`,
    href: `/assets/${a.id}`,
    health: a.health,
  }));
}
