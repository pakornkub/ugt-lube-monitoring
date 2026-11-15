import { prisma } from '@/lib/prisma';
import { siteWhere } from '@/lib/queries/permissions';
import type { ReadingAttachment, StandardAttachment } from '@/lib/types';

const READING = {
  id: true,
  asset_id: true,
  period: true,
  kind: true,
  file_name: true,
  storage_path: true,
  mime_type: true,
  size_bytes: true,
  created_at: true,
} as const;

export async function listAttachments(
  assetId: string,
  period?: string
): Promise<ReadingAttachment[]> {
  const rows = await prisma.readingAttachment.findMany({
    where: {
      asset_id: assetId,
      is_deleted: false,
      ...(period ? { period } : {}),
      asset: await siteWhere(),
    },
    select: READING,
    orderBy: { created_at: 'desc' },
  });
  return rows.map((r) => ({
    ...r,
    kind: r.kind as ReadingAttachment['kind'],
    created_at: r.created_at.toISOString(),
  }));
}

export async function listStandardAttachments(standardId: string): Promise<StandardAttachment[]> {
  const rows = await prisma.standardAttachment.findMany({
    where: { standard_id: standardId, is_deleted: false },
    select: {
      id: true,
      standard_id: true,
      file_name: true,
      storage_path: true,
      mime_type: true,
      size_bytes: true,
      created_at: true,
    },
    orderBy: { created_at: 'desc' },
  });
  return rows.map((r) => ({ ...r, created_at: r.created_at.toISOString() }));
}
