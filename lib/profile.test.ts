import { describe, it, expect, vi, beforeEach } from 'vitest';

// The "view as" cookie must only ever narrow what an admin sees.
const state = vi.hoisted(() => ({
  cookie: '',
  ownRole: 'viewer',
  roles: {
    admin: ['users:manage', 'assets:read', 'assets:write'],
    viewer: ['assets:read'],
  } as Record<string, string[]>,
}));

vi.mock('react', async (orig) => ({
  ...(await orig<typeof import('react')>()),
  cache: <T>(fn: T) => fn,
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (state.cookie ? { value: state.cookie } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: async () => ({ user: { id: 'u1' } }) } },
}));
vi.mock('@/lib/prisma', () => {
  const keysOf = (roleId: string) =>
    (state.roles[roleId] ?? []).map((key) => ({ permission: { key } }));
  return {
    prisma: {
      user: {
        findUnique: async ({ select }: { select: Record<string, unknown> }) =>
          select.userRole
            ? { userRole: { permissions: keysOf(state.ownRole) } }
            : { id: 'u1', name: 'U', email: 'u@x', roleId: state.ownRole, siteAccess: '[]' },
      },
      role: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          state.roles[where.id] ? { id: where.id } : null,
      },
      rolePermission: {
        findMany: async ({ where }: { where: { roleId: string } }) => keysOf(where.roleId),
      },
    },
  };
});

import { getCurrentProfile } from './profile';
import { hasPermission } from './queries/permissions';

beforeEach(() => {
  state.cookie = '';
});

describe('view as', () => {
  it('ignores the cookie for a user without users:manage', async () => {
    state.ownRole = 'viewer';
    state.cookie = 'admin';
    const p = await getCurrentProfile();
    expect(p?.role).toBe('viewer');
    expect(p?.real_role).toBeUndefined();
    expect(await hasPermission('users:manage')).toBe(false);
  });

  it("shows an admin the previewed role's screens, never more than their own", async () => {
    state.ownRole = 'admin';
    state.cookie = 'viewer';
    const p = await getCurrentProfile();
    expect([p?.role, p?.real_role]).toEqual(['viewer', 'admin']);
    expect(await hasPermission('assets:read')).toBe(true);
    expect(await hasPermission('assets:write')).toBe(false);
  });

  it('ignores a role that does not exist', async () => {
    state.ownRole = 'admin';
    state.cookie = 'ghost';
    expect((await getCurrentProfile())?.role).toBe('admin');
  });
});
