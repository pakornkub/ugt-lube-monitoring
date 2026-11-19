import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseList } from '@/lib/db/json';
import type { Profile } from '@/lib/types';

// "View as" — the role picked in the sidebar's user card to preview the app as.
// Honoured only for a user holding users:manage, and it only changes what is
// SHOWN — server actions still check the user's own permissions (requirePermission).
export const VIEW_AS_COOKIE = 'view-as';

export async function viewAsCookie(): Promise<string> {
  return (await cookies()).get(VIEW_AS_COOKIE)?.value ?? '';
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  roleId: string | null;
  siteAccess: string[];
}

// The signed-in user (Better Auth session → User row), once per request. null = not signed in.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, roleId: true, siteAccess: true },
  });
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    roleId: u.roleId,
    siteAccess: parseList(u.siteAccess),
  };
});

// Permission keys held by the user's OWN role (never the previewed one).
export const getOwnPermissions = cache(async (userId: string): Promise<string[]> => {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      userRole: { select: { permissions: { select: { permission: { select: { key: true } } } } } },
    },
  });
  return u?.userRole?.permissions.map((rp) => rp.permission.key) ?? [];
});

// Returns the current user's profile, or null if not signed in. A user without a
// role yet gets role "" — every permission check then answers no.
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const profile: Profile = {
    id: user.id,
    full_name: user.name,
    email: user.email,
    role: user.roleId ?? '',
    site_access: user.siteAccess,
  };

  // View as: only for users:manage, only an existing role. A forged cookie from anyone else is ignored.
  const as = await viewAsCookie();
  if (as && as !== profile.role && (await getOwnPermissions(user.id)).includes('users:manage')) {
    const role = await prisma.role.findUnique({ where: { id: as }, select: { id: true } });
    if (role) return { ...profile, role: as, real_role: profile.role };
  }
  return profile;
});
