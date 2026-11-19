import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { asset: { findMany } } }));
vi.mock('@/lib/queries/permissions', () => ({
  siteWhere: async () => ({ site: { in: ['TSL'] } }),
}));

import { globalSearch } from './search';

beforeEach(() => findMany.mockReset().mockResolvedValue([]));

describe('globalSearch', () => {
  it('returns [] for an empty/whitespace query without querying', async () => {
    expect(await globalSearch('   ')).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("matches id or name within the user's plants, max 8, query cut to 100 chars", async () => {
    await globalSearch('A'.repeat(500));
    const args = findMany.mock.calls[0][0];
    expect(args.take).toBe(8);
    expect(args.where.site).toEqual({ in: ['TSL'] });
    expect(args.where.OR).toEqual([
      { id: { contains: 'a'.repeat(100) } },
      { name: { contains: 'a'.repeat(100) } },
    ]);
  });

  it('maps rows to asset results linking to the drill-down', async () => {
    findMany.mockResolvedValue([
      { id: '34-U02-B', name: 'Lube Pump B', type: 'Pump', site: 'TSL', health: 90 },
    ]);
    const [r] = await globalSearch('lube');
    expect(r).toMatchObject({
      type: 'asset',
      id: '34-U02-B',
      title: 'Lube Pump B',
      href: '/assets/34-U02-B',
      health: 90,
    });
  });
});
