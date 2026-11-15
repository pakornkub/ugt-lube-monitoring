import { describe, it, expect, vi, beforeEach } from 'vitest';

// computeHealth = the old SQL compute_health: latest readings + per-asset overrides
// through getDeductionBreakdown, cached on the asset row.
const state = vi.hoisted(() => ({
  asset: null as Record<string, unknown> | null,
  saved: null as unknown,
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    alarmParam: {
      findMany: async () => [
        {
          category: 'oil',
          key: 'tan',
          name: 'TAN',
          unit: '',
          description: null,
          warn_limit: 0.5,
          crit_limit: 1,
          warn_penalty: 10,
          crit_penalty: 25,
          id: 'p1',
        },
      ],
    },
    scoreConfig: {
      findUnique: async () => ({
        oil_weight: 100,
        vib_weight: 0,
        warn_penalty: 15,
        crit_penalty: 30,
      }),
    },
    asset: {
      findUnique: async () => state.asset,
      update: async (args: unknown) => (state.saved = args),
    },
  },
}));

import { computeHealth } from './recompute';

beforeEach(() => {
  state.saved = null;
});

describe('computeHealth', () => {
  it('scores the latest oil reading and caches health + status', async () => {
    state.asset = {
      vg_grade: 46,
      alarmOverrides: [],
      scoreOverride: null,
      oil_readings: [{ period: '2026-10', tan: 2 }],
      vib_readings: [],
    };
    await computeHealth('A-1');
    expect(state.saved).toEqual({ where: { id: 'A-1' }, data: { health: 75, status: 'Warning' } });
  });

  it('applies a per-asset limit override', async () => {
    state.asset = {
      vg_grade: 46,
      alarmOverrides: [
        {
          category: 'oil',
          key: 'tan',
          warn_limit: 5,
          crit_limit: 10,
          warn_penalty: null,
          crit_penalty: null,
        },
      ],
      scoreOverride: null,
      oil_readings: [{ period: '2026-10', tan: 2 }],
      vib_readings: [],
    };
    await computeHealth('A-1');
    expect(state.saved).toEqual({ where: { id: 'A-1' }, data: { health: 100, status: 'Healthy' } });
  });

  it('no readings → 100 / Healthy', async () => {
    state.asset = {
      vg_grade: 46,
      alarmOverrides: [],
      scoreOverride: null,
      oil_readings: [],
      vib_readings: [],
    };
    await computeHealth('A-1');
    expect(state.saved).toEqual({ where: { id: 'A-1' }, data: { health: 100, status: 'Healthy' } });
  });
});
