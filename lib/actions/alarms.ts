'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { runAction, type ActionResult } from './result';
import { logAudit } from './audit-log';
import { requireAssetPermission, requirePermission } from './guards';
import { siteWhere } from '@/lib/queries/permissions';
import { computeHealth, recomputeAllHealth } from '@/lib/scoring/recompute';
import { getAlarmConfig, getAssetAlarmConfig, type AssetAlarmConfig } from '@/lib/queries/alarms';
import { WEIGHT_MSG, weightsOk } from '@/lib/validation';

// Thin server-action wrapper so the client component can fetch a specific
// asset's effective (merged) alarm config on demand (query functions aren't
// directly callable from "use client" code).
export async function getAssetAlarmConfigAction(assetId: string): Promise<AssetAlarmConfig> {
  return getAssetAlarmConfig(assetId);
}

export interface AlarmSaveInput {
  params: {
    id: string;
    warn_limit: number | null;
    crit_limit: number | null;
    warn_penalty: number;
    crit_penalty: number;
  }[];
  scoreConfig: {
    oil_weight: number;
    vib_weight: number;
    warn_penalty: number;
    crit_penalty: number;
  };
}

// Penalties and weights are 0–100 (the form keeps them there); the server checks too:
// a negative penalty adds points in SQL but is skipped by the TS port (lib/scoring/audit.ts).
const PCT_MSG = 'ค่าหักคะแนนและน้ำหนักต้องอยู่ระหว่าง 0–100';
function penaltiesInRange(input: {
  params: { warn_penalty?: number | null; crit_penalty?: number | null }[];
  scoreConfig: {
    oil_weight?: number | null;
    vib_weight?: number | null;
    warn_penalty?: number | null;
    crit_penalty?: number | null;
  };
}): boolean {
  const s = input.scoreConfig;
  return [
    ...input.params.flatMap((p) => [p.warn_penalty, p.crit_penalty]),
    s.oil_weight,
    s.vib_weight,
    s.warn_penalty,
    s.crit_penalty,
  ].every((v) => v == null || (Number.isFinite(v) && v >= 0 && v <= 100));
}

export async function saveAlarmConfig(input: AlarmSaveInput): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requirePermission('alarms:write');
    if (!auth.ok) return auth.error;
    if (!penaltiesInRange(input)) return { ok: false, message: PCT_MSG };
    if (!weightsOk(input.scoreConfig.oil_weight, input.scoreConfig.vib_weight))
      return { ok: false, message: WEIGHT_MSG };

    // One transaction: the limits and the weights change together or not at all.
    await prisma.$transaction([
      ...input.params.map((p) =>
        prisma.alarmParam.update({
          where: { id: p.id },
          data: {
            warn_limit: p.warn_limit,
            crit_limit: p.crit_limit,
            warn_penalty: p.warn_penalty,
            crit_penalty: p.crit_penalty,
            updated_by: auth.userId,
          },
        })
      ),
      prisma.scoreConfig.upsert({
        where: { id: 1 },
        update: { ...input.scoreConfig, updated_by: auth.userId },
        create: { id: 1, ...input.scoreConfig, updated_by: auth.userId },
      }),
    ]);

    // Recompute every machine with the new limits (the prototype's "บันทึก" button).
    await recomputeAllHealth();

    revalidatePath('/dashboard');
    revalidatePath('/config/alarms');
    revalidatePath('/assets', 'layout');
    await logAudit({
      action: 'UPDATE',
      table_name: 'alarm_params',
      record_id: 'config',
      new_value: { paramCount: input.params.length, scoreConfig: input.scoreConfig },
    });
    return {
      ok: true,
      message: 'บันทึกการตั้งค่าสำเร็จ และคำนวณคะแนนสุขภาพใหม่ทั้งหมด',
    };
  });
}

export interface AssetAlarmSaveInput {
  assetId: string;
  params: {
    category: 'oil' | 'vib';
    key: string;
    warn_limit: number | null;
    crit_limit: number | null;
    warn_penalty: number | null;
    crit_penalty: number | null;
  }[];
  scoreConfig: {
    oil_weight: number | null;
    vib_weight: number | null;
    warn_penalty: number | null;
    crit_penalty: number | null;
  };
}

// Always writes a FULL override (never a partial diff) — every param row and the
// score-override row are replaced wholesale on each save, so the asset's override
// state is exactly what's currently shown in the editor, with no stale leftovers.
export async function saveAssetAlarmOverride(input: AssetAlarmSaveInput): Promise<ActionResult> {
  return runAction(async (): Promise<ActionResult> => {
    const auth = await requireAssetPermission('alarms:write', input.assetId);
    if (!auth.ok) return auth.error;
    if (!penaltiesInRange(input)) return { ok: false, message: PCT_MSG };
    const { oil_weight, vib_weight } = input.scoreConfig;
    if (oil_weight != null || vib_weight != null) {
      // one weight left empty uses the system-wide one: Oil 70 + global Vib 0 would cap the machine at 70
      const { scoreConfig: base } = await getAlarmConfig();
      if (!weightsOk(oil_weight, vib_weight, base)) return { ok: false, message: WEIGHT_MSG };
    }

    const rows = input.params
      .filter(
        (p) =>
          p.warn_limit != null ||
          p.crit_limit != null ||
          p.warn_penalty != null ||
          p.crit_penalty != null
      )
      .map((p) => ({ asset_id: input.assetId, ...p }));
    const hasScoreOverride =
      input.scoreConfig.oil_weight != null ||
      input.scoreConfig.vib_weight != null ||
      input.scoreConfig.warn_penalty != null ||
      input.scoreConfig.crit_penalty != null;
    // One transaction: the machine's override state becomes exactly what the editor shows.
    await prisma.$transaction([
      prisma.assetAlarmOverride.deleteMany({ where: { asset_id: input.assetId } }),
      ...(rows.length ? [prisma.assetAlarmOverride.createMany({ data: rows })] : []),
      hasScoreOverride
        ? prisma.assetScoreOverride.upsert({
            where: { asset_id: input.assetId },
            update: input.scoreConfig,
            create: { asset_id: input.assetId, ...input.scoreConfig },
          })
        : prisma.assetScoreOverride.deleteMany({ where: { asset_id: input.assetId } }),
    ]);
    await computeHealth(input.assetId);

    revalidatePath('/dashboard');
    revalidatePath('/config/alarms');
    revalidatePath(`/assets/${input.assetId}`);
    await logAudit({
      action: 'UPDATE',
      table_name: 'asset_alarm_overrides',
      record_id: input.assetId,
      new_value: { paramCount: rows.length, scoreConfig: input.scoreConfig },
    });
    return { ok: true, message: 'บันทึกค่าเฉพาะเครื่องนี้สำเร็จ' };
  });
}

// Pushes the global oil/vib weight onto every asset that currently has a
// score override — used by the "ปรับทั้งหมด" button next to Overall Score
// Weighting so an engineer doesn't have to open each override one by one just
// to re-sync its weight after changing the global value. Only the weight
// fields are touched; any warn_penalty/crit_penalty override on those assets
// is left as-is, since that's a separate concern (Penalty Default).
export async function applyWeightToAllOverrides(
  oil_weight: number,
  vib_weight: number
): Promise<ActionResult> {
  return runAction(async (): Promise<ActionResult> => {
    const auth = await requirePermission('alarms:write');
    if (!auth.ok) return auth.error;
    if (!weightsOk(oil_weight, vib_weight)) return { ok: false, message: WEIGHT_MSG };

    // only the machines in the user's plants, as the RLS policy limited it
    const assetIds = (
      await prisma.assetScoreOverride.findMany({
        where: { asset: await siteWhere() },
        select: { asset_id: true },
      })
    ).map((r) => r.asset_id);
    if (assetIds.length > 0) {
      await prisma.assetScoreOverride.updateMany({
        where: { asset_id: { in: assetIds } },
        data: { oil_weight, vib_weight },
      });
    }
    await recomputeAllHealth();

    revalidatePath('/dashboard');
    revalidatePath('/config/alarms');
    revalidatePath('/assets', 'layout');
    await logAudit({
      action: 'UPDATE',
      table_name: 'asset_score_overrides',
      record_id: 'all',
      new_value: { assetCount: assetIds.length, oil_weight, vib_weight },
    });
    return {
      ok: true,
      message:
        assetIds.length > 0
          ? `ปรับน้ำหนักคะแนนของ ${assetIds.length} เครื่องที่มีค่าเฉพาะเครื่องให้ตรงกับค่ากลางแล้ว`
          : 'ไม่มีเครื่องจักรที่ตั้งค่าเฉพาะเครื่องอยู่ — ทุกเครื่องใช้ค่ากลางอยู่แล้ว',
    };
  });
}

export async function deleteAssetAlarmOverride(assetId: string): Promise<ActionResult> {
  return runAction(async (): Promise<ActionResult> => {
    const auth = await requireAssetPermission('alarms:write', assetId);
    if (!auth.ok) return auth.error;

    await prisma.$transaction([
      prisma.assetAlarmOverride.deleteMany({ where: { asset_id: assetId } }),
      prisma.assetScoreOverride.deleteMany({ where: { asset_id: assetId } }),
    ]);
    await computeHealth(assetId);

    revalidatePath('/dashboard');
    revalidatePath('/config/alarms');
    revalidatePath(`/assets/${assetId}`);
    await logAudit({ action: 'DELETE', table_name: 'asset_alarm_overrides', record_id: assetId });
    return { ok: true, message: 'รีเซ็ตเป็นค่ากลางสำเร็จ' };
  });
}
