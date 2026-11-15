import 'server-only';
import { prisma } from '@/lib/prisma';

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
