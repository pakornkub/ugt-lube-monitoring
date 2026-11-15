import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  user: null as null | { id: string; siteAccess: string[] },
  grants: [] as string[],
  assetInScope: true,
}));

vi.mock('@/lib/profile', () => ({
  getSessionUser: async () => state.user,
  getOwnPermissions: async () => state.grants,
}));
vi.mock('@/lib/queries/permissions', () => ({
  canAccessAsset: async () => state.assetInScope,
}));

import { requireAssetPermission, requirePermission } from './guards';

beforeEach(() => {
  state.user = { id: 'user-1', siteAccess: [] };
  state.grants = [];
  state.assetInScope = true;
});

describe('requirePermission', () => {
  it('rejects when there is no session', async () => {
    state.user = null;
    const res = await requirePermission('assets:write');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain('กรุณาเข้าสู่ระบบ');
  });

  it('rejects when the role lacks the permission', async () => {
    state.grants = ['assets:read'];
    const res = await requirePermission('users:manage');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain('ไม่มีสิทธิ์');
  });

  it("allows when the role holds it, returning the caller's userId", async () => {
    state.grants = ['assets:write'];
    const res = await requirePermission('assets:write');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.userId).toBe('user-1');
  });
});

describe('requireAssetPermission (plant scope, was RLS can_access_site)', () => {
  it("refuses a machine outside the user's plants even with the permission", async () => {
    state.grants = ['readings:write'];
    state.assetInScope = false;
    expect((await requireAssetPermission('readings:write', 'X-1')).ok).toBe(false);
  });

  it('allows a machine in scope', async () => {
    state.grants = ['readings:write'];
    expect((await requireAssetPermission('readings:write', 'X-1')).ok).toBe(true);
  });
});
