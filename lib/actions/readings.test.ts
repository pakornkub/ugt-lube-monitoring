import { describe, it, expect, vi } from 'vitest';

const { upsert, transaction, createMany } = vi.hoisted(() => ({
  upsert: vi.fn((args: unknown) => args),
  transaction: vi.fn(async (ops: unknown[]) => ops),
  createMany: vi.fn(async () => ({ count: 0 })),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('./guards', () => ({ requirePermission: async () => ({ ok: true, userId: 'u1' }) }));
vi.mock('./audit-log', () => ({ logAudit: vi.fn() }));
vi.mock('@/lib/queries/readings', () => ({}));
vi.mock('@/lib/queries/permissions', () => ({ siteWhere: async () => ({}) }));
vi.mock('@/lib/scoring/recompute', () => ({ computeHealth: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    asset: { findMany: async () => [{ id: 'A' }, { id: 'B' }, { id: 'C' }] },
    oilReading: {
      findMany: async () => [{ asset_id: 'A', period: '2026-09', fe: 99, visc: null }],
      upsert,
    },
    activityLog: { createMany },
    $transaction: transaction,
  },
}));

import { saveOilBatch } from './readings';

describe('saveOilBatch', () => {
  it('saves a file in one transaction per column set, never sends unsent columns, and reports bad rows', async () => {
    const res = await saveOilBatch([
      { assetId: 'A', period: '2026-09', values: { fe: 120, visc: 216 } },
      { assetId: 'B', period: '2026-09', values: { visc: 46 } },
      { assetId: 'C', period: '2026-09', values: { visc: 50, fe: 5 } },
      { assetId: 'D', period: '2026-09', values: { fe: 1 } }, // unknown TAG: never created
      { assetId: 'A', period: '2099-01', values: { fe: 1 } }, // future period
    ]);
    expect(res.saved).toBe(3);
    expect(res.failedKeys).toEqual(['D|2026-09', 'A|2099-01']);
    // A and C share columns; B has only visc, so its upsert can't write fe = null
    expect(transaction).toHaveBeenCalledTimes(2);
    const groups = (
      transaction.mock.calls as unknown as [{ create: Record<string, unknown> }[]][]
    ).map(([ops]) =>
      ops.map((o) =>
        Object.keys(o.create)
          .filter((k) => k !== 'created_by')
          .sort()
          .join(',')
      )
    );
    expect(groups).toEqual([
      ['asset_id,fe,period,visc', 'asset_id,fe,period,visc'],
      ['asset_id,period,visc'],
    ]);
    // one audit write for the whole file, with the old value of the overwritten column
    expect(createMany).toHaveBeenCalledTimes(1);
    const audit = (
      createMany.mock.calls as unknown as [
        { data: { recordId: string; oldValue: string | null }[] },
      ][]
    )[0][0].data;
    expect(audit.map((a) => a.recordId)).toEqual(['A/2026-09', 'C/2026-09', 'B/2026-09']);
    expect(JSON.parse(audit[0].oldValue!)).toEqual({ fe: 99, visc: null });
  });

  it('keeps the raw DB error out of the message the browser gets', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    transaction.mockRejectedValueOnce(
      new Error('Invalid `prisma.oilReading.upsert()`: CHECK constraint "OilReadings_ck"')
    );
    const res = await saveOilBatch([{ assetId: 'B', period: '2026-09', values: { visc: 46 } }]);
    expect(res.failedKeys).toEqual(['B|2026-09']);
    expect(JSON.stringify(res)).not.toMatch(/prisma|OilReadings_ck/);
  });
});
