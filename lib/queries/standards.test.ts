import { describe, it, expect, vi, beforeEach } from 'vitest';

const { standardFindMany, standardFindUnique, userFindMany } = vi.hoisted(() => ({
  standardFindMany: vi.fn(),
  standardFindUnique: vi.fn(),
  userFindMany: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    standard: { findMany: standardFindMany, findUnique: standardFindUnique },
    user: { findMany: userFindMany },
  },
}));

import { getStandard, listStandards } from './standards';

const row = (id: string, updated_by: string | null) => ({
  id,
  category: 'CUSTOM',
  title: `STD ${id}`,
  subtitle: null,
  description: null,
  full_text: null,
  tags: null,
  version: 1,
  updated_at: new Date('2026-11-17T00:00:00Z'),
  updated_by,
  related_params: null,
  asset_types: null,
  related_standard_ids: null,
});

beforeEach(() => {
  standardFindMany.mockReset();
  standardFindUnique.mockReset();
  userFindMany.mockReset().mockResolvedValue([]);
});

describe('standards editor name', () => {
  it('shows the editor by name, falls back to email, keeps an unknown id as-is', async () => {
    standardFindMany.mockResolvedValue([
      row('a', 'u1'),
      row('b', 'u2'),
      row('c', 'gone'),
      row('d', null),
    ]);
    userFindMany.mockResolvedValue([
      { id: 'u1', name: 'Smoke Admin', email: 'admin@x.test' },
      { id: 'u2', name: '', email: 'two@x.test' },
    ]);
    const names = (await listStandards({})).map((s) => s.updated_by_name);
    expect(names).toEqual(['Smoke Admin', 'two@x.test', 'gone', null]);
    expect(userFindMany).toHaveBeenCalledTimes(1);
  });

  it('skips the user query when nobody edited', async () => {
    standardFindUnique.mockResolvedValue(row('a', null));
    expect((await getStandard('a'))?.updated_by_name).toBeNull();
    expect(userFindMany).not.toHaveBeenCalled();
  });
});
