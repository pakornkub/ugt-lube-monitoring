'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { dateOnly, toDate } from '@/lib/db/json';
import { runAction, type ActionResult } from './result';
import { requireAssetPermission } from './guards';
import { logAudit } from './audit-log';

export async function addMaintenance(input: {
  assetId: string;
  type: 'pm' | 'cm';
  work_date: string;
  wo_no: string;
  description: string;
  parts: string;
  cost: number;
  technician: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requireAssetPermission('maintenance:write', input.assetId);
    if (!auth.ok) return auth.error;
    const row = {
      type: input.type,
      work_date: input.work_date || null,
      wo_no: input.wo_no || null,
      description: input.description,
      parts: input.parts || null,
      cost: input.cost || 0,
      technician: input.technician || null,
    };
    const created = await prisma.maintenanceRecord.create({
      data: {
        asset_id: input.assetId,
        ...row,
        work_date: toDate(row.work_date),
        created_by: auth.userId,
      },
      select: { id: true },
    });
    // "<asset>/maint/<id>": the machine's history tab finds it like a reading ("<asset>/<period>").
    await logAudit({
      action: 'INSERT',
      table_name: 'maintenance_records',
      record_id: `${input.assetId}/maint/${created.id}`,
      new_value: row,
    });
    revalidatePath(`/assets/${input.assetId}`);
    return { ok: true, message: 'บันทึกประวัติการซ่อมบำรุงสำเร็จ' };
  });
}

export async function deleteMaintenance(id: string, assetId: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requireAssetPermission('maintenance:write', assetId);
    if (!auth.ok) return auth.error;
    // Read it first, so the history shows what was deleted.
    const before = await prisma.maintenanceRecord.findFirst({
      where: { id, asset_id: assetId },
      select: {
        type: true,
        work_date: true,
        wo_no: true,
        description: true,
        parts: true,
        cost: true,
        technician: true,
      },
    });
    if (!before) return { ok: false, message: 'ไม่พบรายการนี้ หรือไม่มีสิทธิ์แก้ไขรายการของโรงงานนี้' };
    await prisma.maintenanceRecord.delete({ where: { id } });
    await logAudit({
      action: 'DELETE',
      table_name: 'maintenance_records',
      record_id: `${assetId}/maint/${id}`,
      old_value: { ...before, work_date: dateOnly(before.work_date) },
    });
    revalidatePath(`/assets/${assetId}`);
    return { ok: true, message: 'ลบรายการสำเร็จ' };
  });
}
