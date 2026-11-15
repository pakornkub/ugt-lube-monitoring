'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { importRow } from '@/lib/asset-import';
import { toDate } from '@/lib/db/json';
import { runAction, type ActionResult } from './result';
import { requireAssetPermission, requirePermission } from './guards';
import { logAudit } from './audit-log';
import { getAllAssets } from '@/lib/queries/assets';
import { getSiteScope, siteWhere } from '@/lib/queries/permissions';
import { computeHealth, recomputeAllHealth } from '@/lib/scoring/recompute';
import type { Asset } from '@/lib/types';

// The only columns a user may write. health/status are the Health Score cache
// (iron rule) and must never come from the client — the TS types below are
// not checked at runtime.
const EDITABLE = [
  'name',
  'type',
  'site',
  'vg_grade',
  'motor_kw',
  'rpm',
  'oil_brand',
  'oil_qty_l',
  'oil_change_months',
  'oil_sample_months',
] as const;

const OUT_OF_SCOPE = 'ไม่พบรายการนี้ หรือไม่มีสิทธิ์แก้ไขรายการของโรงงานนี้';

async function siteInScope(site: string): Promise<boolean> {
  const scope = await getSiteScope();
  return scope === null || scope.includes(site);
}

export async function createAsset(input: {
  id: string;
  name: string;
  type: string;
  site: string;
  vg_grade: number;
  motor_kw: number;
  rpm: number;
  oil_brand: string;
  oil_qty_l: number;
  oil_change_months: number;
  oil_sample_months: number;
}): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requirePermission('assets:write');
    if (!auth.ok) return auth.error;
    if (!(await siteInScope(input.site))) return { ok: false, message: OUT_OF_SCOPE };
    if (await prisma.asset.findUnique({ where: { id: input.id }, select: { id: true } })) {
      return { ok: false, message: 'ID นี้มีอยู่แล้ว' };
    }
    await prisma.asset.create({
      data: {
        id: input.id,
        name: input.name,
        type: input.type,
        site: input.site,
        vg_grade: input.vg_grade,
        motor_kw: input.motor_kw,
        rpm: input.rpm,
        oil_brand: input.oil_brand,
        oil_qty_l: input.oil_qty_l,
        oil_change_months: input.oil_change_months,
        oil_sample_months: input.oil_sample_months,
        health: 100,
        status: 'Healthy',
        last_update: new Date().toISOString().slice(0, 7),
        created_by: auth.userId,
      },
    });
    await logAudit({
      action: 'INSERT',
      table_name: 'assets',
      record_id: input.id,
      new_value: { ...input },
    });
    revalidatePath('/assets');
    revalidatePath('/dashboard');
    return { ok: true, message: 'เพิ่มเครื่องจักรสำเร็จ' };
  });
}

export async function updateAsset(
  id: string,
  input: Partial<{
    name: string;
    type: string;
    site: string;
    vg_grade: number;
    motor_kw: number;
    rpm: number;
    oil_brand: string;
    oil_qty_l: number;
    oil_change_months: number;
    oil_sample_months: number;
  }>
): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requireAssetPermission('assets:write', id);
    if (!auth.ok) return auth.error;
    const patch = Object.fromEntries(EDITABLE.filter((k) => k in input).map((k) => [k, input[k]]));
    // moving a machine to a plant the user can't see would hide it from them
    if (typeof patch.site === 'string' && !(await siteInScope(patch.site)))
      return { ok: false, message: OUT_OF_SCOPE };
    const before = await prisma.asset.findUnique({
      where: { id },
      select: Object.fromEntries(EDITABLE.map((k) => [k, true])) as Record<
        (typeof EDITABLE)[number],
        true
      >,
    });
    if (!before) return { ok: false, message: OUT_OF_SCOPE };
    await prisma.asset.update({ where: { id }, data: { ...patch, updated_by: auth.userId } });
    // Viscosity is scored against the VG grade, so a new grade moves the score.
    if ('vg_grade' in patch) await computeHealth(id);
    // History shows "VG 2 → 220": keep only the fields that really changed.
    const old = before as Record<string, unknown>;
    const changed = Object.keys(patch).filter(
      (k) => String(old[k] ?? '') !== String(patch[k] ?? '')
    );
    await logAudit({
      action: 'UPDATE',
      table_name: 'assets',
      record_id: id,
      old_value: Object.fromEntries(changed.map((k) => [k, old[k] ?? null])),
      new_value: Object.fromEntries(changed.map((k) => [k, patch[k]])),
    });
    revalidatePath('/assets');
    revalidatePath(`/assets/${id}`);
    revalidatePath('/dashboard');
    return { ok: true, message: 'บันทึกการแก้ไขสำเร็จ' };
  });
}

export async function deleteAsset(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requirePermission('assets:delete');
    if (!auth.ok) return auth.error;
    const { count } = await prisma.asset.deleteMany({ where: { id, ...(await siteWhere()) } });
    if (!count) return { ok: false, message: OUT_OF_SCOPE };
    await logAudit({ action: 'DELETE', table_name: 'assets', record_id: id });
    revalidatePath('/assets');
    revalidatePath('/dashboard');
    return { ok: true, message: 'ลบสำเร็จ' };
  });
}

export async function deleteAssets(ids: string[]): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requirePermission('assets:delete');
    if (!auth.ok) return auth.error;
    const where = { id: { in: ids }, ...(await siteWhere()) };
    const gone = (await prisma.asset.findMany({ where, select: { id: true } })).map((r) => r.id);
    if (!gone.length) return { ok: false, message: OUT_OF_SCOPE };
    await prisma.asset.deleteMany({ where: { id: { in: gone } } });
    await logAudit({ action: 'DELETE', table_name: 'assets', record_id: gone.join(',') });
    revalidatePath('/assets');
    revalidatePath('/dashboard');
    const skipped = ids.length - gone.length;
    return {
      ok: true,
      message: `ลบ ${gone.length} รายการสำเร็จ${skipped ? ` (ข้าม ${skipped} รายการที่ไม่มีสิทธิ์หรือไม่พบ)` : ''}`,
    };
  });
}

export async function deleteAllAssets(): Promise<ActionResult> {
  return runAction(async () => {
    // Wiping the entire fleet needs the stricter assets:delete_all permission
    // (engineers with plain assets:delete may still delete individual assets
    // through deleteAsset/deleteAssets).
    const auth = await requirePermission('assets:delete_all');
    if (!auth.ok) return auth.error;
    // still limited to the user's plants, as the RLS delete policy was
    await prisma.asset.deleteMany({ where: await siteWhere() });
    await logAudit({ action: 'DELETE', table_name: 'assets', record_id: '__all__' });
    revalidatePath('/assets');
    revalidatePath('/dashboard');
    return { ok: true, message: 'ลบทั้งหมดแล้ว' };
  });
}

export async function importAssets(items: Asset[]): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requirePermission('assets:import');
    if (!auth.ok) return auth.error;
    const existing = new Map((await getAllAssets()).map((a) => [a.id, a]));
    // A machine id that exists in a plant the user can't see must not be overwritten.
    const hidden = new Set(
      (await prisma.asset.findMany({ select: { id: true } }))
        .map((r) => r.id)
        .filter((id) => !existing.has(id))
    );
    const scope = await getSiteScope();
    // An unknown plant or type would fail the foreign key, so those rows are left out and named instead.
    const [siteRows, typeRows] = await Promise.all([
      prisma.site.findMany({ select: { code: true } }),
      prisma.assetType.findMany({ select: { name: true } }),
    ]);
    const sites = new Set(
      siteRows.map((s) => s.code).filter((c) => scope === null || scope.includes(c))
    );
    const types = new Set(typeRows.map((t) => t.name));
    // The same ID twice: keep the last row, name the ID.
    const byId = new Map<string, Asset>();
    const dupIds = new Set<string>();
    for (const x of items.filter((x) => x && x.id && x.name)) {
      if (byId.has(x.id)) dupIds.add(x.id);
      byId.set(x.id, x);
    }
    const all = [...byId.values()].map((x) => importRow(x, existing.get(x.id)));
    // vg_grade and the month cycles are int columns: "4.5" would reject the row.
    const intOk = (r: (typeof all)[number]) =>
      [r.vg_grade, r.oil_change_months, r.oil_sample_months].every(
        (v) => v == null || Number.isInteger(v)
      );
    const rows = all.filter(
      (r) => sites.has(r.site) && types.has(r.type) && intOk(r) && !hidden.has(r.id)
    );
    const skipped = all.filter((r) => !rows.includes(r) && intOk(r)).map((r) => r.id);
    const notInt = all.filter((r) => !intOk(r)).map((r) => r.id);
    const list = (xs: string[]) => `${xs.slice(0, 10).join(', ')}${xs.length > 10 ? ' …' : ''}`;
    const skipNote =
      (skipped.length
        ? ` · ข้าม ${skipped.length} แถวที่ไม่ระบุโรงงาน หรือโรงงาน/ประเภทไม่มีในระบบ: ${list(skipped)}`
        : '') +
      (notInt.length
        ? ` · ข้าม ${notInt.length} แถวที่ VG / รอบเปลี่ยน / รอบเก็บตัวอย่างไม่ใช่จำนวนเต็ม: ${list(notInt)}`
        : '') +
      (dupIds.size ? ` · รหัสซ้ำในไฟล์ (ใช้แถวล่างสุด): ${list([...dupIds])}` : '');
    if (rows.length === 0) return { ok: false, message: `ไม่มีข้อมูลที่ถูกต้อง${skipNote}` };
    // one transaction: the whole file lands or none of it does (as the single upsert did)
    await prisma.$transaction(
      rows.map(({ install_date, ...r }) => {
        const data = { ...r, ...(install_date ? { install_date: toDate(install_date) } : {}) };
        return prisma.asset.upsert({
          where: { id: r.id },
          update: { ...data, updated_by: auth.userId },
          create: { ...data, created_by: auth.userId },
        });
      })
    );
    // VG grades may have changed, which moves viscosity scores.
    await recomputeAllHealth();
    await logAudit({
      action: 'INSERT',
      table_name: 'assets',
      record_id: rows.map((r) => r.id).join(','),
      new_value: { count: rows.length },
    });
    revalidatePath('/assets');
    revalidatePath('/dashboard');
    return { ok: true, message: `นำเข้า ${rows.length} รายการสำเร็จ${skipNote}` };
  });
}

export async function exportAssetsJson(): Promise<string> {
  try {
    return JSON.stringify(await getAllAssets(), null, 2);
  } catch (e) {
    console.error('[exportAssetsJson]', e);
    return '[]';
  }
}
