import { syncPermissionsIfNeeded } from '@/lib/permissions-sync';

// Admin section (ugt-nextjs-auth-setup §5.6 merge branch): the pages sit inside the
// app's own shell and guard themselves; this layout only keeps the Permission table in
// step with lib/permissions.ts, so a key added in code shows up in Admin → Roles.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await syncPermissionsIfNeeded().catch((e) => console.error('[admin] permission sync failed', e));
  return <>{children}</>;
}
