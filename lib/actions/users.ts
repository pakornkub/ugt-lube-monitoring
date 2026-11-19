'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { toList } from '@/lib/db/json';
import { runAction, type ActionResult } from './result';
import { requirePermission } from './guards';
import { logAudit } from './audit-log';
import { listUsers, managersLeft, type UserRow } from '@/lib/queries/users';

// Accounts are created by the first Keycloak (SSO) login — there is no create/invite
// here. An admin assigns the role and plant access afterwards.

// Client-callable snapshot for the "ดาวน์โหลด Excel" button — listUsers()
// itself already requires users:manage, so no separate guard needed here.
export async function getUsersForExport(q: string): Promise<UserRow[]> {
  const { rows } = await listUsers({ q, page: 1, pageSize: 100000 });
  return rows;
}

export async function updateUserRole(
  userId: string,
  role: string,
  siteAccess: string[]
): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requirePermission('users:manage');
    if (!auth.ok) return auth.error;
    if (!(await prisma.role.findUnique({ where: { id: role }, select: { id: true } }))) {
      return { ok: false, message: 'ไม่พบ Role นี้' };
    }
    // moving someone to a role without users:manage must leave somebody who still has it
    const keeps = await prisma.rolePermission.count({
      where: { roleId: role, permission: { key: 'users:manage' } },
    });
    if (!keeps && (await managersLeft({ withoutUser: userId })) === 0) {
      return {
        ok: false,
        message:
          'ต้องมีผู้ใช้อย่างน้อย 1 คนที่จัดการผู้ใช้ได้ (users:manage) เสมอ มิฉะนั้นจะไม่มีใครเข้าหน้าจัดการ Role/ผู้ใช้ได้อีก',
      };
    }
    const { count } = await prisma.user.updateMany({
      where: { id: userId },
      data: { roleId: role, siteAccess: toList(siteAccess) },
    });
    if (!count) return { ok: false, message: 'ไม่พบผู้ใช้นี้' };
    await logAudit({
      action: 'UPDATE',
      table_name: 'users',
      record_id: userId,
      new_value: { role, site_access: siteAccess },
    });
    revalidatePath('/admin/users');
    return { ok: true, message: 'อัปเดตบทบาทสำเร็จ' };
  });
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requirePermission('users:manage');
    if (!auth.ok) return auth.error;
    if (userId === auth.userId) {
      return { ok: false, message: 'ไม่สามารถลบบัญชีตัวเองได้ (ป้องกันระบบไร้ admin)' };
    }
    // Session/Account rows cascade; ActivityLogs keep the user id as plain text.
    const { count } = await prisma.user.deleteMany({ where: { id: userId } });
    if (!count) return { ok: false, message: 'ไม่พบผู้ใช้นี้' };
    await logAudit({ action: 'DELETE', table_name: 'users', record_id: userId });
    revalidatePath('/admin/users');
    return { ok: true, message: 'ลบผู้ใช้สำเร็จ' };
  });
}
