'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { runAction, type ActionResult } from './result';
import { requireAssetPermission, requirePermission } from './guards';
import { logAudit } from './audit-log';
import { AUDIT_ACTIONS } from '@/lib/audit-actions';
import { listStandardAttachments } from '@/lib/queries/attachments';
import type { StandardAttachment } from '@/lib/types';

// Uploads go through POST /api/files (lib/upload-client.ts) — a Route Handler,
// because Server Actions cap the body at 1 MB. Downloads go through the guarded
// GET /api/files/<target>/<id>. Deleting is a soft delete; the retention sweep
// removes the bytes after 90 days (app/api/cron/attachments-sweep).

function fileUrl(target: 'reading' | 'standard', id: string): string {
  return `${env.NEXT_PUBLIC_BASE_PATH}/api/files/${target}/${id}`;
}

export async function createDownloadUrl(
  storagePath: string
): Promise<{ ok: boolean; url?: string; message: string }> {
  return runAction(async () => {
    const auth = await requirePermission('attachments:read');
    if (!auth.ok) return auth.error;
    const row = await prisma.readingAttachment.findFirst({
      where: { storage_path: storagePath, is_deleted: false },
      select: { id: true },
    });
    if (!row) return { ok: false, message: 'ไม่พบไฟล์' };
    return { ok: true, url: fileUrl('reading', row.id), message: 'ok' };
  });
}

export async function deleteAttachment(
  id: string,
  _storagePath: string,
  assetId: string
): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requireAssetPermission('attachments:write', assetId);
    if (!auth.ok) return auth.error;
    const { count } = await prisma.readingAttachment.updateMany({
      where: { id, asset_id: assetId, is_deleted: false },
      data: { is_deleted: true, updated_by: auth.userId },
    });
    if (!count) return { ok: false, message: 'ไม่พบรายการนี้ หรือไม่มีสิทธิ์แก้ไขรายการของโรงงานนี้' };
    await logAudit({
      action: AUDIT_ACTIONS.FILE_DELETE,
      table_name: 'reading_attachments',
      record_id: id,
    });
    revalidatePath(`/assets/${assetId}`);
    return { ok: true, message: 'ลบไฟล์แนบสำเร็จ' };
  });
}

// ---- Standards attachments (originals in the Standards Library) ----

export async function createStandardDownloadUrl(
  storagePath: string
): Promise<{ ok: boolean; url?: string; message: string }> {
  return runAction(async () => {
    const auth = await requirePermission('attachments:read');
    if (!auth.ok) return auth.error;
    const row = await prisma.standardAttachment.findFirst({
      where: { storage_path: storagePath, is_deleted: false },
      select: { id: true },
    });
    if (!row) return { ok: false, message: 'ไม่พบไฟล์' };
    return { ok: true, url: fileUrl('standard', row.id), message: 'ok' };
  });
}

export async function deleteStandardAttachment(
  id: string,
  _storagePath: string
): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requirePermission('attachments:write');
    if (!auth.ok) return auth.error;
    const { count } = await prisma.standardAttachment.updateMany({
      where: { id, is_deleted: false },
      data: { is_deleted: true, updated_by: auth.userId },
    });
    if (!count) return { ok: false, message: 'ไม่พบรายการนี้ หรือไม่มีสิทธิ์แก้ไขรายการนี้' };
    await logAudit({
      action: AUDIT_ACTIONS.FILE_DELETE,
      table_name: 'standard_attachments',
      record_id: id,
    });
    revalidatePath('/standards');
    return { ok: true, message: 'ลบไฟล์แนบสำเร็จ' };
  });
}

// Client-callable snapshot (the modal lives in a client component).
export async function getStandardAttachments(standardId: string): Promise<StandardAttachment[]> {
  return listStandardAttachments(standardId);
}
