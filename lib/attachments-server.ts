import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { deleteStoredFile } from '@/lib/storage';

// The two attachment kinds (ugt-nextjs-upload-setup, linked by a real FK per owner):
//   reading  → ReadingAttachments  (a machine's lab report; plant scope applies)
//   standard → StandardAttachments (an original document in the Standards library)
export type AttachmentTarget = 'reading' | 'standard';

export function isTarget(v: string): v is AttachmentTarget {
  return v === 'reading' || v === 'standard';
}

export interface StoredRow {
  id: string;
  storage_path: string;
  file_name: string;
  size_bytes: number | null;
  asset_id?: string;
}

/** A live (not soft-deleted) row of either kind, or null. */
export async function findAttachment(
  target: AttachmentTarget,
  id: string
): Promise<StoredRow | null> {
  const select = { id: true, storage_path: true, file_name: true, size_bytes: true } as const;
  return target === 'reading'
    ? prisma.readingAttachment.findFirst({
        where: { id, is_deleted: false },
        select: { ...select, asset_id: true },
      })
    : prisma.standardAttachment.findFirst({ where: { id, is_deleted: false }, select });
}

/** Volume keys of the files a machine delete is about to cascade away (soft-deleted ones too). */
export async function readingFileKeys(assetWhere: Prisma.assetWhereInput): Promise<string[]> {
  const rows = await prisma.readingAttachment.findMany({
    where: { asset: assetWhere },
    select: { storage_path: true },
  });
  return rows.map((r) => r.storage_path);
}

/** Volume keys of a standard's files, read before the standard (and its rows) is deleted. */
export async function standardFileKeys(standardId: string): Promise<string[]> {
  const rows = await prisma.standardAttachment.findMany({
    where: { standard_id: standardId },
    select: { storage_path: true },
  });
  return rows.map((r) => r.storage_path);
}

/** Remove the bytes once their owner rows are gone. Best effort: a file left behind is
 *  picked up by the sweep's orphan step; it must not fail a delete that already happened. */
export async function removeStoredFiles(keys: string[]): Promise<void> {
  for (const key of keys) {
    await deleteStoredFile(key).catch((e) =>
      console.error('[attachments] file not removed', key, e)
    );
  }
}
