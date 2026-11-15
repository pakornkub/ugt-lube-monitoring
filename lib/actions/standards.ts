'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { toList } from '@/lib/db/json';
import { runAction, type ActionResult } from './result';
import { requirePermission } from './guards';
import { logAudit } from './audit-log';
import { listStandards } from '@/lib/queries/standards';
import type { Standard, StandardCategory } from '@/lib/types';

type StandardInput = {
  title: string;
  category: StandardCategory;
  subtitle: string;
  description: string;
  full_text: string;
  tags: string;
  related_params?: string[];
  asset_types?: string[];
  related_standard_ids?: string[];
};

function parseTags(s: string): string[] {
  return s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function fields(input: StandardInput) {
  return {
    title: input.title,
    category: input.category,
    subtitle: input.subtitle || null,
    description: input.description || null,
    full_text: input.full_text || null,
    tags: toList(parseTags(input.tags)),
    related_params: toList(input.related_params),
    asset_types: toList(input.asset_types),
    related_standard_ids: toList(input.related_standard_ids),
  };
}

export async function createStandard(input: StandardInput): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requirePermission('standards:write');
    if (!auth.ok) return auth.error;
    await prisma.standard.create({
      data: { ...fields(input), version: 1, created_by: auth.userId },
    });
    await logAudit({
      action: 'INSERT',
      table_name: 'standards',
      record_id: input.title,
      new_value: { title: input.title, category: input.category },
    });
    revalidatePath('/standards');
    return { ok: true, message: 'เพิ่มมาตรฐานสำเร็จ' };
  });
}

// Edit + version bump (document control: every edit becomes a new version).
export async function updateStandard(id: string, input: StandardInput): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requirePermission('standards:write');
    if (!auth.ok) return auth.error;
    const cur = await prisma.standard.findUnique({ where: { id }, select: { version: true } });
    if (!cur) return { ok: false, message: 'ไม่พบมาตรฐานนี้ในระบบ' };
    const version = cur.version ?? 1;

    await prisma.standard.update({
      where: { id },
      data: { ...fields(input), version: version + 1, updated_by: auth.userId },
    });
    await logAudit({
      action: 'UPDATE',
      table_name: 'standards',
      record_id: id,
      new_value: { title: input.title, version: version + 1 },
    });
    revalidatePath('/standards');
    return { ok: true, message: `บันทึกการแก้ไขสำเร็จ (v${version + 1})` };
  });
}

export async function deleteStandard(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requirePermission('standards:write');
    if (!auth.ok) return auth.error;
    // its attachment rows cascade; the bytes are removed by the retention sweep's orphan-file step
    const { count } = await prisma.standard.deleteMany({ where: { id } });
    if (!count) return { ok: false, message: 'ไม่พบรายการนี้ หรือไม่มีสิทธิ์แก้ไขรายการของโรงงานนี้' };
    await logAudit({ action: 'DELETE', table_name: 'standards', record_id: id });
    revalidatePath('/standards');
    return { ok: true, message: 'ลบมาตรฐานแล้ว' };
  });
}

// Client-side refresh after mutations (the page list is stateful).
export async function getStandardsSnapshot(): Promise<Standard[]> {
  return listStandards({});
}
