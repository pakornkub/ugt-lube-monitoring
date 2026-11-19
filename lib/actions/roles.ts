'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { toList } from '@/lib/db/json';
import { runAction, type ActionResult } from './result';
import { requirePermission } from './guards';
import { logAudit } from './audit-log';
import { MENU_HREFS } from '@/lib/nav';
import { managersLeft } from '@/lib/queries/users';

// role id is a primary key referenced from User.RoleId, the "view as" cookie and
// URLs — keep it a plain slug.
const SLUG_RE = /^[a-z][a-z0-9_-]{1,31}$/;

export async function createRole(id: string, label: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requirePermission('users:manage');
    if (!auth.ok) return auth.error;
    const slug = id.trim().toLowerCase();
    if (!SLUG_RE.test(slug)) {
      return { ok: false, message: 'รหัส Role ต้องเป็นตัวอักษรเล็ก/ตัวเลข/_/- เริ่มด้วยตัวอักษร (2-32 ตัว)' };
    }
    if (!label.trim()) return { ok: false, message: 'กรุณาระบุชื่อ Role' };
    if (
      await prisma.role.findFirst({
        where: { OR: [{ id: slug }, { name: label.trim() }] },
        select: { id: true },
      })
    ) {
      return { ok: false, message: 'มี Role รหัสหรือชื่อนี้อยู่แล้ว' };
    }

    await prisma.role.create({ data: { id: slug, name: label.trim(), isSystem: false } });
    await logAudit({
      action: 'INSERT',
      table_name: 'roles',
      record_id: slug,
      new_value: { label },
    });
    revalidatePath('/admin/roles');
    return { ok: true, message: 'สร้าง Role สำเร็จ' };
  });
}

export async function deleteRole(roleId: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requirePermission('users:manage');
    if (!auth.ok) return auth.error;

    // The only guard now (the Supabase trigger + FK are gone): system roles stay,
    // a role still held by someone stays.
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { isSystem: true },
    });
    if (!role) return { ok: false, message: 'ไม่พบ Role นี้' };
    if (role.isSystem) return { ok: false, message: 'ไม่สามารถลบ Role ระบบได้' };
    const count = await prisma.user.count({ where: { roleId } });
    if (count > 0)
      return { ok: false, message: `ยังมีผู้ใช้ ${count} คนใช้ Role นี้อยู่ — ย้าย role ผู้ใช้ก่อนลบ` };

    await prisma.role.delete({ where: { id: roleId } });
    await logAudit({ action: 'DELETE', table_name: 'roles', record_id: roleId });
    revalidatePath('/admin/roles');
    return { ok: true, message: 'ลบ Role สำเร็จ' };
  });
}

// The role's sidebar layout: which main-menu links sit on top, in order. View only —
// it grants nothing (links still follow permissions). Empty/null = the original sidebar.
export async function setRoleMenu(roleId: string, hrefs: string[] | null): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requirePermission('users:manage');
    if (!auth.ok) return auth.error;
    const list = hrefs ?? [];
    if (list.some((h) => !MENU_HREFS.includes(h)) || new Set(list).size !== list.length) {
      return { ok: false, message: 'รายการเมนูไม่ถูกต้อง' };
    }
    const { count } = await prisma.role.updateMany({
      where: { id: roleId },
      data: { menuMain: list.length ? toList(list) : null },
    });
    if (!count) return { ok: false, message: 'ไม่พบ Role นี้' };
    await logAudit({
      action: 'UPDATE',
      table_name: 'roles',
      record_id: roleId,
      new_value: { menu_main: list },
    });
    revalidatePath('/', 'layout');
    return { ok: true, message: 'บันทึกเมนูสำเร็จ' };
  });
}

// Always writes the FULL permission set for a role (never a partial diff): the
// checkbox grid shown in the editor becomes exactly this role's grants.
export async function setRolePermissions(
  roleId: string,
  permissionKeys: string[]
): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requirePermission('users:manage');
    if (!auth.ok) return auth.error;

    // Guard against locking every account out of role/user administration.
    // Counts people, not roles: an empty role holding users:manage would otherwise pass.
    if (
      !permissionKeys.includes('users:manage') &&
      (await managersLeft({ withoutRole: roleId })) === 0
    ) {
      return {
        ok: false,
        message:
          "ไม่สามารถถอดสิทธิ์ 'จัดการผู้ใช้ (users:manage)' ออกได้ — ต้องมีผู้ใช้อย่างน้อย 1 คนที่มีสิทธิ์นี้เสมอ มิฉะนั้นจะไม่มีใครเข้าหน้าจัดการ Role/ผู้ใช้ได้อีก",
      };
    }
    if (!(await prisma.role.findUnique({ where: { id: roleId }, select: { id: true } }))) {
      return { ok: false, message: 'ไม่พบ Role นี้' };
    }

    const perms = await prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true },
    });
    // One transaction: the role ends with exactly the new set, or keeps its old one.
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      ...perms.map((p) => prisma.rolePermission.create({ data: { roleId, permissionId: p.id } })),
    ]);
    await logAudit({
      action: 'UPDATE',
      table_name: 'role_permissions',
      record_id: roleId,
      new_value: { permissionKeys },
    });
    revalidatePath('/admin/roles');
    return { ok: true, message: 'บันทึกสิทธิ์สำเร็จ' };
  });
}
