'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { isFuturePeriod, isPeriod } from '@/lib/parse/period';
import { STORED_COLS, readingCols } from '@/lib/reading-fields';
import { getReadingsHistory } from '@/lib/queries/readings';
import { siteWhere } from '@/lib/queries/permissions';
import { computeHealth } from '@/lib/scoring/recompute';
import type { OilReading, VibReading } from '@/lib/types';
import { runAction, type ActionResult } from './result';
import { requireAssetPermission, requirePermission } from './guards';
import { logAudit } from './audit-log';

export interface ReadingInput {
  assetId: string;
  period: string; // YYYY-MM
  kind: 'oil' | 'vib';
  values: Record<string, number | string | null>;
}

type Cols = Record<string, number | string | null>;
const key = (asset_id: string, period: string) => ({ asset_id_period: { asset_id, period } });

// One reading table by kind — the two delegates have the same shape for what is used here.
function table(kind: 'oil' | 'vib') {
  return (kind === 'oil'
    ? prisma.oilReading
    : prisma.vibReading) as unknown as typeof prisma.oilReading;
}

// Delete one period's oil or vibration reading (a reading saved on the wrong machine or month),
// then recompute the machine's Health Score from what is left.
export async function deleteReading(input: {
  assetId: string;
  period: string;
  kind: 'oil' | 'vib';
}): Promise<ActionResult> {
  const { assetId, period, kind } = input;
  if (!assetId || !isPeriod(period) || (kind !== 'oil' && kind !== 'vib'))
    return { ok: false, message: 'ข้อมูลไม่ถูกต้อง' };
  return runAction(async () => {
    const auth = await requireAssetPermission('readings:write', assetId);
    if (!auth.ok) return auth.error;
    const old = await table(kind).findUnique({ where: key(assetId, period) });
    if (!old) return { ok: false, message: 'ไม่พบผลงวดนี้ หรือไม่มีสิทธิ์ลบ' };
    await table(kind).delete({ where: key(assetId, period) });
    await computeHealth(assetId);
    await logAudit({
      action: 'DELETE',
      table_name: `${kind}_readings`,
      record_id: `${assetId}|${period}`,
      old_value: old as unknown as Record<string, unknown>,
    });
    revalidatePath('/dashboard');
    revalidatePath('/assets');
    revalidatePath(`/assets/${assetId}`);
    return { ok: true, message: `ลบผล${kind === 'oil' ? 'น้ำมัน' : 'สั่นสะเทือน'} งวด ${period} แล้ว` };
  });
}

export async function saveReading(input: ReadingInput): Promise<ActionResult> {
  return runAction(async () => {
    if (!isPeriod(input.period) || !input.assetId) {
      return { ok: false, message: 'ข้อมูลไม่ครบ (เครื่องจักร / งวด)' };
    }
    const auth = await requireAssetPermission('readings:write', input.assetId);
    if (!auth.ok) return auth.error;
    if (isFuturePeriod(input.period))
      return { ok: false, message: `งวด ${input.period} อยู่ในอนาคต — ตรวจวันที่เก็บตัวอย่าง` };
    const t = table(input.kind);
    const cols = readingCols(input);
    // Nothing to write (e.g. a files-only save): no reading row — an empty one would
    // count as the latest reading and score 100.
    let before: Record<string, unknown> | null = null;
    if (Object.keys(cols).length > 0) {
      const old = (await t.findUnique({ where: key(input.assetId, input.period) })) as Record<
        string,
        unknown
      > | null;
      before = old ? Object.fromEntries(Object.keys(cols).map((k) => [k, old[k] ?? null])) : null;
      // Only the sent columns are written, so the update leaves the others alone.
      const row = (await t.upsert({
        where: key(input.assetId, input.period),
        update: { ...cols, updated_by: auth.userId } as never,
        create: {
          asset_id: input.assetId,
          period: input.period,
          ...cols,
          created_by: auth.userId,
        } as never,
      })) as unknown as Record<string, unknown>;
      // Clearing the last value leaves an empty row: delete it so the previous period counts again.
      if (STORED_COLS[input.kind].every((c) => row[c] == null))
        await t.delete({ where: key(input.assetId, input.period) });
      await computeHealth(input.assetId);
    }

    revalidatePath('/dashboard');
    revalidatePath('/assets');
    revalidatePath(`/assets/${input.assetId}`);
    await logAudit({
      action: 'UPSERT',
      table_name: input.kind === 'oil' ? 'oil_readings' : 'vib_readings',
      record_id: `${input.assetId}/${input.period}`,
      old_value: before ?? undefined,
      new_value: cols,
    });
    return { ok: true, message: 'บันทึกข้อมูลสำเร็จ' };
  });
}

// What is already saved for this machine + period, so Data Entry can show it and
// let the user clear a wrong value (saveReading leaves unsent columns alone).
export async function getSavedReadings(
  assetId: string,
  period: string
): Promise<{ oil: OilReading | null; vib: VibReading | null }> {
  if (!assetId || !isPeriod(period)) return { oil: null, vib: null };
  const h = await getReadingsHistory(assetId);
  return {
    oil: h.oil.find((r) => r.period === period) ?? null,
    vib: h.vib.find((r) => r.period === period) ?? null,
  };
}

export interface OilBatchRow {
  assetId: string;
  period: string;
  values: Record<string, number | string | null>;
}
export type BatchResult = ActionResult & {
  saved?: number;
  failedKeys?: string[];
  failed?: string[];
};

const batchKey = (assetId: string, period: string) => `${assetId}|${period}`;
const CHUNK = 1000; // SQL Server: 2100 parameters per statement

// A whole lab file in one request: one permission check, one transaction per set of columns,
// one audit write and one page refresh. Rows go into a transaction only with rows that have
// the same columns, so a file without TAN never writes TAN = null over a saved one.
export async function saveOilBatch(rows: OilBatchRow[]): Promise<BatchResult> {
  return runAction(async (): Promise<BatchResult> => {
    const auth = await requirePermission('readings:write');
    if (!auth.ok) return auth.error;
    const failedKeys: string[] = [];
    const failed: string[] = [];
    const fail = (assetId: string, period: string, why: string) => {
      failedKeys.push(batchKey(assetId, period));
      failed.push(`${assetId} (${period}): ${why}`);
    };

    // Machines the user may write (their plants) — an unknown or hidden TAG never creates a row.
    const askedIds = [...new Set(rows.map((r) => r.assetId).filter(Boolean))];
    const known = new Set<string>();
    const scope = await siteWhere();
    for (let i = 0; i < askedIds.length; i += CHUNK) {
      const found = await prisma.asset.findMany({
        where: { id: { in: askedIds.slice(i, i + CHUNK) }, ...scope },
        select: { id: true },
      });
      for (const a of found) known.add(a.id);
    }

    const good: ({ asset_id: string; period: string } & Cols)[] = [];
    for (const r of rows) {
      const cols = readingCols({ kind: 'oil', values: r.values });
      if (!r.assetId || !isPeriod(r.period))
        fail(r.assetId, r.period, 'ข้อมูลไม่ครบ (เครื่องจักร / งวด)');
      else if (isFuturePeriod(r.period)) fail(r.assetId, r.period, `งวด ${r.period} อยู่ในอนาคต`);
      else if (!known.has(r.assetId))
        fail(r.assetId, r.period, `ไม่พบเครื่องจักร "${r.assetId}" ในระบบ หรือไม่มีสิทธิ์เข้าถึงโรงงานนี้`);
      else if (Object.keys(cols).length > 0)
        good.push({ asset_id: r.assetId, period: r.period, ...cols });
    }

    // Old values for the audit log (only the machines and months in the file).
    const before = new Map<string, Record<string, unknown>>();
    const ids = [...new Set(good.map((r) => r.asset_id))];
    const periods = [...new Set(good.map((r) => r.period))];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const old = await prisma.oilReading.findMany({
        where: { asset_id: { in: ids.slice(i, i + CHUNK) }, period: { in: periods } },
      });
      for (const o of old)
        before.set(batchKey(o.asset_id, o.period), o as unknown as Record<string, unknown>);
    }

    const groups = new Map<string, typeof good>();
    for (const r of good) {
      const k = Object.keys(r).sort().join(',');
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    const saved: typeof good = [];
    for (const g of groups.values()) {
      try {
        await prisma.$transaction(
          g.map(({ asset_id, period, ...cols }) =>
            prisma.oilReading.upsert({
              where: key(asset_id, period),
              update: { ...cols, updated_by: auth.userId } as never,
              create: { asset_id, period, ...cols, created_by: auth.userId } as never,
            })
          )
        );
        saved.push(...g);
      } catch (e) {
        for (const r of g)
          fail(r.asset_id, r.period, e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
      }
    }

    if (saved.length > 0) {
      for (const id of new Set(saved.map((r) => r.asset_id))) await computeHealth(id);
      try {
        await prisma.activityLog.createMany({
          data: saved.map(({ asset_id, period, ...cols }) => {
            const old = before.get(batchKey(asset_id, period));
            return {
              userId: auth.userId,
              action: 'UPSERT',
              tableName: 'oil_readings',
              recordId: `${asset_id}/${period}`,
              oldValue: old
                ? JSON.stringify(
                    Object.fromEntries(Object.keys(cols).map((k) => [k, old[k] ?? null]))
                  )
                : null,
              newValue: JSON.stringify(cols),
            };
          }),
        });
      } catch {
        // history must never block the save
      }
      revalidatePath('/dashboard');
      revalidatePath('/assets');
      revalidatePath('/assets/[id]', 'page');
    }
    return {
      ok: failed.length === 0,
      saved: saved.length,
      failedKeys,
      failed,
      message: `บันทึก ${saved.length} รายการ`,
    };
  });
}

// "asset|period" pairs that already have an oil reading, so a lab-file import can
// ask before it overwrites them (plant-scoped like every read). null = the lookup failed:
// the import must not go ahead as if nothing were saved.
export async function getExistingOilKeys(
  assetIds: string[],
  periods: string[]
): Promise<string[] | null> {
  const ids = [...new Set(assetIds.filter(Boolean))];
  const months = [...new Set(periods.filter(isPeriod))];
  if (ids.length === 0 || months.length === 0) return [];
  try {
    const scope = { asset: await siteWhere() };
    const out: string[] = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const rows = await prisma.oilReading.findMany({
        where: { asset_id: { in: ids.slice(i, i + CHUNK) }, period: { in: months }, ...scope },
        select: { asset_id: true, period: true },
      });
      for (const r of rows) out.push(batchKey(r.asset_id, r.period));
    }
    return out;
  } catch {
    return null;
  }
}
