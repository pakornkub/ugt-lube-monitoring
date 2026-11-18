// kit: ugt-nextjs-platform 4.91.0 · ugt-nextjs-auth-setup/lib/actions/admin-setup.ts
// kit-hash: c7c308a4b546
'use server';

// lib/actions/admin-setup.ts — first-admin bootstrap Server Action.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { syncPermissionsIfNeeded } from '@/lib/permissions-sync';
import { isAdminInitialized } from '@/lib/get-user-permissions';
import { DEFAULT_ROLES } from '@/lib/permissions';
import { logAudit } from '@/lib/actions/audit-log';
import { AUDIT_ACTIONS } from '@/lib/audit-actions';

/**
 * Initialise the admin system:
 * 1. Seed all permission rows
 * 2. Create the app roles (admin = system role with every permission)
 * 3. Assign the current user to admin
 *
 * Idempotent: returns an error if a system role already exists.
 */
export async function initializeAdminAction(): Promise<{
  code: string;
} | void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { code: 'UNAUTHORIZED' };

  const alreadyDone = await isAdminInitialized();
  if (alreadyDone) return { code: 'ALREADY_INITIALIZED' };

  // 1. Seed permissions — upsert เสมอ ห้าม createMany เปล่า: isAdminInitialized
  // เช็คแค่ role ระบบ ไม่ได้เช็คตาราง Permission — bootstrap รอบก่อนที่พังกลางคัน
  // (seed สำเร็จแต่ยังไม่ได้สร้าง role) จะทิ้งแถวไว้ แล้ว retry ชน unique key ค้าง
  // อยู่หน้า setup ตลอด (skipDuplicates ก็ใช้ไม่ได้บน SQL Server)
  await syncPermissionsIfNeeded();

  // 2. The app's four roles (ids = the old slugs, lib/permissions.ts DEFAULT_ROLES).
  //    'admin' is the system role that marks the app as set up; the other three are
  //    created alongside it so every screen has the roles it always had.
  const permissions = await prisma.permission.findMany({ select: { id: true, key: true } });
  const idOf = new Map(permissions.map((p) => [p.key, p.id]));
  for (const r of DEFAULT_ROLES) {
    // every permission except dev-mode:enable (testers only — it reroutes mail to the actor)
    const permIds =
      r.id === 'admin'
        ? permissions.filter((p) => p.key !== 'dev-mode:enable').map((p) => p.id)
        : r.permissions.map((k) => idOf.get(k)!).filter(Boolean);
    await prisma.role.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        name: r.name,
        isSystem: true, // the four shipped roles cannot be deleted (as before)
        menuMain: JSON.stringify(r.menuMain),
        permissions: { create: permIds.map((id) => ({ permission: { connect: { id } } })) },
      },
    });
  }

  // 3. Assign the current user as the first admin
  await prisma.user.update({
    where: { id: session.user.id },
    data: { roleId: 'admin' },
  });
  await logAudit({
    action: AUDIT_ACTIONS.ADMIN_BOOTSTRAP,
    table_name: 'users',
    record_id: session.user.id,
    new_value: { role: 'admin', roles_created: DEFAULT_ROLES.map((r) => r.id) },
  });

  redirect('/admin/users'); // the app's own user admin page
}
