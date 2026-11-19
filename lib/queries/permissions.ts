import { prisma } from '@/lib/prisma';
import { parseList } from '@/lib/db/json';
import { getCurrentProfile, getOwnPermissions, getSessionUser, viewAsCookie } from '@/lib/profile';
import type { Permission, Role } from '@/lib/types';

// Server-Component-side permission check — the same role → permission tables that
// requirePermission() (lib/actions/guards.ts) reads, so a page's UI-gating decision
// (show/hide a "+ create" button) never drifts from what the action allows.
export async function hasPermission(perm: string): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;
  // An admin previewing a role ("view as") sees that role's screens: the previewed
  // grants AND the user's own — a preview can only hide, never add.
  if (await viewAsCookie()) {
    const profile = await getCurrentProfile();
    if (
      profile?.real_role !== undefined &&
      !(await getRolePermissionKeys(profile.role)).includes(perm)
    )
      return false;
  }
  return (await getOwnPermissions(user.id)).includes(perm);
}

// Plants the signed-in user may see — null = every plant. Replaces the Supabase RLS
// rule can_access_site(): system:bypass_site_access, or an empty site_access, sees all.
export async function getSiteScope(): Promise<string[] | null> {
  const user = await getSessionUser();
  if (!user) return [];
  if (user.siteAccess.length === 0) return null;
  if ((await getOwnPermissions(user.id)).includes('system:bypass_site_access')) return null;
  return user.siteAccess;
}

/** Prisma `where` fragment on an asset's plant for the current user. */
export async function siteWhere(): Promise<{ site?: { in: string[] } }> {
  const scope = await getSiteScope();
  return scope ? { site: { in: scope } } : {};
}

/** True when the current user may see/touch this machine (its plant is in scope). */
export async function canAccessAsset(assetId: string): Promise<boolean> {
  const a = await prisma.asset.findFirst({
    where: { id: assetId, ...(await siteWhere()) },
    select: { id: true },
  });
  return !!a;
}

function toRole(r: { id: string; name: string; isSystem: boolean; menuMain: string | null }): Role {
  return {
    id: r.id,
    label: r.name,
    is_system: r.isSystem,
    menu_main: r.menuMain == null ? null : parseList(r.menuMain),
  };
}

export async function listRoles(): Promise<Role[]> {
  const rows = await prisma.role.findMany({ orderBy: { name: 'asc' } });
  return rows.map(toRole);
}

// The role's sidebar layout (menu_main). null on any error, so the sidebar falls back
// to the original menu instead of failing the page.
export async function getRoleMenu(roleId: string): Promise<string[] | null> {
  if (!roleId) return null;
  try {
    const r = await prisma.role.findUnique({ where: { id: roleId }, select: { menuMain: true } });
    return r?.menuMain == null ? null : parseList(r.menuMain);
  } catch {
    return null;
  }
}

// Permission keys granted to a given role (for pre-checking checkboxes in the role editor).
export async function getRolePermissionKeys(roleId: string): Promise<string[]> {
  if (!roleId) return [];
  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { permission: { select: { key: true } } },
  });
  return rows.map((r) => r.permission.key);
}

// All roles + their granted permission keys in one shot (the /admin/roles matrix).
export async function listRolesWithPermissions(): Promise<{
  roles: Role[];
  permissions: Permission[];
  grants: Record<string, string[]>;
}> {
  const [roles, perms, rps] = await Promise.all([
    prisma.role.findMany({ orderBy: { name: 'asc' } }),
    prisma.permission.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] }),
    prisma.rolePermission.findMany({
      select: { roleId: true, permission: { select: { key: true } } },
    }),
  ]);
  const grants: Record<string, string[]> = {};
  for (const row of rps) (grants[row.roleId] ??= []).push(row.permission.key);
  return {
    roles: roles.map(toRole),
    permissions: perms.map((p) => ({ key: p.key, label: p.label, category: p.group })),
    grants,
  };
}
