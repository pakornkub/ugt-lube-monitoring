import { NextResponse } from 'next/server';
import { requireAssetPermission, requirePermission } from '@/lib/actions/guards';
import { logAudit } from '@/lib/actions/audit-log';
import { AUDIT_ACTIONS } from '@/lib/audit-actions';
import { readStoredFile } from '@/lib/storage';
import { findAttachment, isTarget } from '@/lib/attachments-server';

/**
 * Download. Every byte leaves through here — files sit on a volume, not in
 * public/, so this guard cannot be bypassed by knowing a URL.
 * session → permission → plant scope (reading files) → stream + audit
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ target: string; id: string }> }
) {
  const { target, id } = await params;
  const notFound = NextResponse.json({ ok: false, message: 'ไม่พบไฟล์' }, { status: 404 });
  if (!isTarget(target)) return notFound;

  // 404 for "missing", "no permission" and "not your plant" alike — a 403 would confirm the id exists.
  if (!(await requirePermission('attachments:read')).ok) return notFound;

  const row = await findAttachment(target, id);
  if (!row) return notFound;
  if (row.asset_id && !(await requireAssetPermission('attachments:read', row.asset_id)).ok)
    return notFound;

  let bytes: Buffer;
  try {
    bytes = await readStoredFile(row.storage_path);
  } catch {
    return notFound;
  }

  await logAudit({
    action: AUDIT_ACTIONS.FILE_DOWNLOAD,
    table_name: `${target}_attachments`,
    record_id: row.id,
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      // Always octet-stream + attachment: serving user content inline is how an
      // uploaded .svg/.html becomes stored XSS on our own domain.
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
      'Content-Length': String(bytes.length),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}
