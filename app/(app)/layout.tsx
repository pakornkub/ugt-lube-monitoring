import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentProfile } from '@/lib/profile';
import { isAdminInitialized } from '@/lib/get-user-permissions';
import {
  getRoleMenu,
  getRolePermissionKeys,
  listRoles,
  siteWhere,
} from '@/lib/queries/permissions';
import { Sidebar as AppNavSidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { SessionExpiredDialog } from '@/components/session-expired-dialog';
import type { NotifItem } from '@/components/layout/NotificationBell';
import type { Asset, AssetStatus } from '@/lib/types';
import { dateOnly } from '@/lib/db/json';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session) {
    // A cookie that no longer maps to a session = it expired; say so on the login page.
    const from = h.get('x-from');
    const params = new URLSearchParams();
    if (h.get('cookie')?.includes('session_token')) params.set('reason', 'session_expired');
    if (from && from !== '/') params.set('from', from);
    redirect(`/login${params.size ? `?${params}` : ''}`);
  }
  // First login on a fresh install → claim Administrator at /admin/setup.
  if (!(await isAdminInitialized())) redirect('/admin/setup');

  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  const scope = await siteWhere();
  const latest = (status: AssetStatus, take: number) =>
    prisma.asset.findMany({ where: { ...scope, status }, orderBy: { health: 'asc' }, take });
  const [crit, warn, criticalCount, warningCount] = await Promise.all([
    latest('Critical', 8),
    latest('Warning', 4),
    prisma.asset.count({ where: { ...scope, status: 'Critical' } }),
    prisma.asset.count({ where: { ...scope, status: 'Warning' } }),
  ]);
  const toAsset = (a: (typeof crit)[number]): Asset => ({
    ...a,
    status: a.status as AssetStatus,
    install_date: dateOnly(a.install_date),
  });
  const notifications: NotifItem[] = [
    ...crit.map((a) => ({ asset: toAsset(a), level: 'crit' as const })),
    ...warn.map((a) => ({ asset: toAsset(a), level: 'warn' as const })),
  ];

  // getRolePermissionKeys throws on a DB error — this layout wraps every
  // route, so a transient DB hiccup here must degrade to "no extra nav items"
  // rather than take down the whole app (unlike the page-level data queries
  // below it, which are allowed to fail their own page via error.tsx).
  let permittedKeys: string[] = [];
  const menuMain = await getRoleMenu(profile.role);
  try {
    permittedKeys = await getRolePermissionKeys(profile.role);
  } catch (err) {
    console.error('[AppLayout] getRolePermissionKeys failed', err);
  }
  // "View as" picker: users:manage only. Previewing ⇒ real_role is set.
  const canViewAs = !!profile.real_role || permittedKeys.includes('users:manage');
  const viewAsRoles = canViewAs ? await listRoles().catch(() => []) : undefined;

  return (
    // fixed inset-0, not h-screen: being positioned keeps absolute descendants (sr-only
    // labels) from escaping to <body> and making the whole page scroll into an empty band.
    <div className="fixed inset-0 flex overflow-hidden">
      <AppNavSidebar
        viewAsRoles={viewAsRoles}
        menuMain={menuMain}
        profile={profile}
        permittedKeys={permittedKeys}
        criticalCount={criticalCount}
        warningCount={warningCount}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title="ศูนย์เฝ้าระวังความเสี่ยง (Fleet Risk Center)"
          notifications={notifications}
          criticalCount={criticalCount}
          warningCount={warningCount}
        />
        {profile.real_role && profile.role !== profile.real_role && (
          <div
            className="bg-cyan/10 px-3 py-1.5 text-center text-[13px] font-semibold text-cyan"
            role="status"
          >
            กำลังดูในมุมมอง role &quot;
            {viewAsRoles?.find((r) => r.id === profile.role)?.label ?? profile.role}&quot; —
            เปลี่ยนแค่เมนูและปุ่มที่เห็น สิทธิ์จริงของคุณไม่เปลี่ยน · กลับได้ที่การ์ดผู้ใช้ท้าย Sidebar
          </div>
        )}
        <main className="relative flex-1 overflow-y-auto px-[19px] py-[15px]">{children}</main>
      </div>
      <SessionExpiredDialog />
    </div>
  );
}
