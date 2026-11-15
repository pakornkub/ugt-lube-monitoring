import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { requireAssetPermission, requirePermission } from '@/lib/actions/guards';
import { logAudit } from '@/lib/actions/audit-log';
import { AUDIT_ACTIONS } from '@/lib/audit-actions';
import { checksum, newStorageKey, safeDisplayName, writeStoredFile } from '@/lib/storage';
import { isTarget } from '@/lib/attachments-server';
import { isPeriod } from '@/lib/parse/period';
import {
  DOC_ATTACHMENT_EXTENSIONS,
  DOC_ATTACHMENT_MIME_TYPES,
  LAB_ATTACHMENT_EXTENSIONS,
  LAB_ATTACHMENT_MIME_TYPES,
  MAX_DOC_ATTACHMENT_BYTES,
  MAX_LAB_ATTACHMENT_BYTES,
  validateAttachment,
} from '@/lib/attachment-rules';

/**
 * Upload a lab report (target=reading: assetId, period, kind) or a standard's
 * original document (target=standard: standardId). A Route Handler, not a Server
 * Action: Server Actions cap the body at 1 MB.
 *
 * session → permission (+ plant scope) → validate → write to volume → row → audit
 * Answers { ok, message, id? } — the app's ActionResult shape.
 */
export async function POST(request: Request) {
  const t = await getTranslations('app.upload');
  const form = await request.formData();
  const file = form.get('file');
  const target = String(form.get('target') ?? '');
  if (!(file instanceof File) || !isTarget(target)) {
    return NextResponse.json({ ok: false, message: t('badRequest') }, { status: 400 });
  }

  const assetId = String(form.get('assetId') ?? '');
  const period = String(form.get('period') ?? '');
  const kind = String(form.get('kind') ?? '');
  const standardId = String(form.get('standardId') ?? '');

  const guard =
    target === 'reading'
      ? await requireAssetPermission('attachments:write', assetId)
      : await requirePermission('attachments:write');
  if (!guard.ok) return NextResponse.json(guard.error, { status: 403 });

  const fileName = safeDisplayName(file.name);
  const mime = file.type || null;
  const invalid =
    target === 'reading'
      ? validateAttachment(
          fileName,
          mime,
          file.size,
          Math.min(MAX_LAB_ATTACHMENT_BYTES, env.UPLOAD_MAX_BYTES),
          LAB_ATTACHMENT_MIME_TYPES,
          LAB_ATTACHMENT_EXTENSIONS
        )
      : validateAttachment(
          fileName,
          mime,
          file.size,
          Math.min(MAX_DOC_ATTACHMENT_BYTES, env.UPLOAD_MAX_BYTES),
          DOC_ATTACHMENT_MIME_TYPES,
          DOC_ATTACHMENT_EXTENSIONS
        );
  if (invalid) return NextResponse.json({ ok: false, message: invalid }, { status: 400 });

  if (target === 'reading') {
    if (!isPeriod(period))
      return NextResponse.json({ ok: false, message: t('badPeriod') }, { status: 400 });
    if (kind !== 'oil' && kind !== 'vib')
      return NextResponse.json({ ok: false, message: t('badKind') }, { status: 400 });
  } else if (
    !(await prisma.standard.findUnique({ where: { id: standardId }, select: { id: true } }))
  ) {
    return NextResponse.json({ ok: false, message: t('standardNotFound') }, { status: 404 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const storageKey = newStorageKey();
  await writeStoredFile(storageKey, bytes);

  const common = {
    file_name: fileName,
    storage_path: storageKey,
    mime_type: mime,
    size_bytes: bytes.length,
    checksum: checksum(bytes),
    uploaded_by: guard.userId,
  };
  const row =
    target === 'reading'
      ? await prisma.readingAttachment.create({
          data: { ...common, asset_id: assetId, period, kind },
          select: { id: true },
        })
      : await prisma.standardAttachment.create({
          data: { ...common, standard_id: standardId },
          select: { id: true },
        });

  await logAudit({
    action: AUDIT_ACTIONS.FILE_UPLOAD,
    table_name: target === 'reading' ? 'reading_attachments' : 'standard_attachments',
    record_id: row.id,
    new_value: {
      file_name: fileName,
      asset_id: assetId || undefined,
      period: period || undefined,
      standard_id: standardId || undefined,
    },
  });

  if (target === 'reading') {
    revalidatePath(`/assets/${assetId}`);
    revalidatePath('/data-entry');
  } else {
    revalidatePath('/standards');
  }
  return NextResponse.json({ ok: true, message: t('uploaded'), id: row.id }, { status: 201 });
}
