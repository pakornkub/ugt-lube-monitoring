import { timingSafeEqual } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { deleteStoredFile } from '@/lib/storage';
import { retentionCutoff } from '@/lib/jobs/retention-cutoff';

/**
 * Attachment retention sweep — host cron only (docs/admin-handoff.md cron table).
 *   1. bytes + row of attachments soft-deleted longer than RETENTION_DAYS
 *   2. files on the volume with no row at all (the row insert failed after the write)
 * Both attachment tables have a real FK to their owner (asset / standard), so there
 * are no orphan rows to sweep. Idempotent. `POST …?dryRun=1` counts and touches nothing.
 * The only code path that hard-deletes attachment rows; the upload history stays in
 * ActivityLogs (file.upload).
 */

export const dynamic = 'force-dynamic';

/** Interview answer (2026-11-15): deleted files keep their bytes 90 days. */
const RETENTION_DAYS = 90;
const ORPHAN_GRACE_MS = 86_400_000; // an upload may be mid-flight
const BATCH = 500;
const KEY_SHAPE = /^\d{4}\/\d{2}\/[0-9a-f-]{36}$/;
const MAX_ORPHAN_SHARE = 0.1; // more files without a row than this = wrong DATABASE_URL? stop

function authorized(request: Request) {
  if (!env.CRON_SECRET) return false;
  const want = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const got = Buffer.from(request.headers.get('authorization') ?? '');
  return got.length === want.length && timingSafeEqual(got, want);
}

async function purgeExpired(cutoff: Date, dryRun: boolean) {
  // The soft delete stamps UpdatedAt; a later edit only pushes the row further out.
  const where = { is_deleted: true, updated_at: { lt: cutoff } };
  const [readings, standards] = await Promise.all([
    prisma.readingAttachment.findMany({
      where,
      select: { id: true, storage_path: true },
      take: BATCH,
    }),
    prisma.standardAttachment.findMany({
      where,
      select: { id: true, storage_path: true },
      take: BATCH,
    }),
  ]);
  let failed = 0;
  if (!dryRun) {
    for (const [rows, del] of [
      [readings, (id: string) => prisma.readingAttachment.deleteMany({ where: { id, ...where } })],
      [
        standards,
        (id: string) => prisma.standardAttachment.deleteMany({ where: { id, ...where } }),
      ],
    ] as const) {
      for (const row of rows) {
        try {
          if ((await del(row.id)).count === 1) await deleteStoredFile(row.storage_path);
        } catch (error) {
          failed++;
          console.error(`[cron] attachments-sweep purge ${row.id}`, error);
        }
      }
    }
  }
  const total = readings.length + standards.length;
  return {
    purged: total - failed,
    failed,
    more: readings.length === BATCH || standards.length === BATCH,
  };
}

async function deleteOrphanFiles(now: Date, dryRun: boolean) {
  const root = resolve(env.STORAGE_ROOT);
  const entries = await readdir(root, { recursive: true, withFileTypes: true }).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name))
    .map((full) => ({
      full,
      key: full
        .slice(root.length + 1)
        .split(sep)
        .join('/'),
    }))
    .filter((f) => KEY_SHAPE.test(f.key));

  const orphans: { full: string; key: string }[] = [];
  for (let i = 0; i < files.length; i += BATCH) {
    const keys = files.slice(i, i + BATCH).map((f) => f.key);
    const where = { storage_path: { in: keys } };
    const known = new Set([
      ...(await prisma.readingAttachment.findMany({ where, select: { storage_path: true } })).map(
        (r) => r.storage_path
      ),
      ...(await prisma.standardAttachment.findMany({ where, select: { storage_path: true } })).map(
        (r) => r.storage_path
      ),
    ]);
    for (const f of files.slice(i, i + BATCH)) {
      if (known.has(f.key)) continue;
      const mtime = (await stat(f.full).catch(() => null))?.mtimeMs;
      if (mtime === undefined || now.getTime() - mtime < ORPHAN_GRACE_MS) continue;
      orphans.push(f);
    }
  }
  if (
    orphans.length &&
    (orphans.length === files.length || orphans.length > files.length * MAX_ORPHAN_SHARE)
  ) {
    console.error(
      `[cron] attachments-sweep: ${orphans.length}/${files.length} files have no row — wrong DATABASE_URL? deleting nothing`
    );
    return { orphanFiles: orphans.length, orphanFilesBlocked: true };
  }
  if (!dryRun) for (const f of orphans) await deleteStoredFile(f.key);
  return { orphanFiles: orphans.length, orphanFilesBlocked: false };
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response('Unauthorized', { status: 401 });
  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';
  const now = new Date();
  const cutoff = retentionCutoff(now, RETENTION_DAYS);
  const expired = await purgeExpired(cutoff, dryRun);
  const files = await deleteOrphanFiles(now, dryRun);
  const result = { dryRun, cutoff: cutoff.toISOString(), ...expired, ...files };
  console.log(`[cron] attachments-sweep ${JSON.stringify(result)}`);
  const ok = expired.failed === 0 && !files.orphanFilesBlocked;
  return Response.json({ ok, ...result }, { status: ok ? 200 : 500 });
}
