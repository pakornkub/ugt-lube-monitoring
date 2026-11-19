import { prisma } from '@/lib/prisma';
import { parseList } from '@/lib/db/json';
import { requirePermission } from '@/lib/actions/guards';

export interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  /** Role id — "" while the user has no role yet (first SSO login). */
  role: string;
  site_access: string[];
  created_at: string;
}

const PAGE_SIZE = 20;

/** The users-admin tab listing people who signed in (SSO) but have no role yet. */
export const NO_ROLE_TAB = 'no-role';

export async function listUsers(
  opts: { q?: string; page?: number; pageSize?: number; tab?: string } = {}
): Promise<{
  rows: UserRow[];
  total: number;
  page: number;
  pages: number;
  pageSize: number;
  /** users with no role yet — the "ยังไม่มีบทบาท" tab badge (before the search filter) */
  noRoleCount: number;
}> {
  const q = (opts.q ?? '').trim().toLowerCase();
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? PAGE_SIZE;

  // Defense in depth: every call site already gates on users:manage — re-check so a
  // future call site can't leak the full user list.
  const auth = await requirePermission('users:manage');
  if (!auth.ok) throw new Error(auth.error.message);

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, roleId: true, siteAccess: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  let all: UserRow[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    full_name: u.name,
    role: u.roleId ?? '',
    site_access: parseList(u.siteAccess),
    created_at: u.createdAt.toISOString(),
  }));

  const noRoleCount = all.filter((u) => !u.role).length;
  if (opts.tab === NO_ROLE_TAB) all = all.filter((u) => !u.role);
  if (q) all = all.filter((u) => `${u.email} ${u.full_name ?? ''}`.toLowerCase().includes(q));

  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * pageSize;
  return { rows: all.slice(start, start + pageSize), total, page: p, pages, pageSize, noRoleCount };
}

/**
 * How many PEOPLE could still manage users if `withoutRole` lost users:manage and/or
 * `withoutUser` lost it (role change). Counting roles is not enough: a role nobody holds keeps
 * the old check happy while no one can open the Admin pages any more. Fails closed (0) on error.
 */
export async function managersLeft(opts: {
  withoutRole?: string;
  withoutUser?: string;
}): Promise<number> {
  try {
    const roles = await prisma.rolePermission.findMany({
      where: { permission: { key: 'users:manage' } },
      select: { roleId: true },
    });
    const ids = roles.map((r) => r.roleId).filter((r) => r !== opts.withoutRole);
    if (!ids.length) return 0;
    return await prisma.user.count({
      where: {
        roleId: { in: ids },
        ...(opts.withoutUser ? { id: { not: opts.withoutUser } } : {}),
      },
    });
  } catch {
    return 0;
  }
}
