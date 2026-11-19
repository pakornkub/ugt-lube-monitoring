'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { toList } from '@/lib/db/json';
import { runAction, type ActionResult } from './result';
import { requirePermission } from './guards';
import { logAudit } from './audit-log';
import { sendEmail } from '@/lib/email/send';
import { buildWeeklyDigest } from '@/lib/email/weekly-digest-build';
import { getNotificationConfig } from '@/lib/queries/notifications';
import { getSiteScope } from '@/lib/queries/permissions';
import { createRateLimiter } from '@/lib/ai/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Sending lands in people's inboxes — cap per user (in-memory, per instance).
const testLimit = createRateLimiter(10, 60 * 60 * 1000); // 10 test sends / hour
const allLimit = createRateLimiter(3, 24 * 60 * 60 * 1000); // 3 sends to everyone / day

export interface NotificationConfigInput {
  email_recipients: string[];
  enable_critical_alerts: boolean;
  enable_weekly_summary: boolean;
}

export async function saveNotificationConfig(
  input: NotificationConfigInput
): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requirePermission('notifications:manage');
    if (!auth.ok) return auth.error;

    const data = {
      email_recipients: toList(input.email_recipients),
      enable_critical_alerts: input.enable_critical_alerts,
      enable_weekly_summary: input.enable_weekly_summary,
      updated_by: auth.userId,
    };
    await prisma.notificationConfig.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });
    await logAudit({
      action: 'UPDATE',
      table_name: 'notification_config',
      record_id: '1',
      new_value: { ...input },
    });
    revalidatePath('/admin/notifications');
    return { ok: true, message: 'บันทึกการตั้งค่าแจ้งเตือนสำเร็จ' };
  });
}

// The email the Monday cron would send now — shown in the settings page, nothing is sent.
// Built from the caller's own plant scope, so it shows only the plants they may see.
export async function previewWeeklyDigest(): Promise<{
  ok: boolean;
  message: string;
  subject?: string;
  html?: string;
}> {
  const auth = await requirePermission('notifications:manage');
  if (!auth.ok) return auth.error;
  try {
    const email = await buildWeeklyDigest();
    return { ok: true, message: 'ok', ...email };
  } catch {
    return { ok: false, message: 'สร้างตัวอย่างอีเมลไม่สำเร็จ' };
  }
}

// Send the weekly digest now: `test` to up to 3 typed addresses (subject marked [ทดสอบ]),
// otherwise to the SAVED recipients — the same list the cron uses.
export async function sendWeeklyDigestNow(input: {
  test: boolean;
  to?: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const auth = await requirePermission('notifications:manage');
    if (!auth.ok) return auth.error;

    const cfg = await getNotificationConfig();
    const to = input.test
      ? (input.to ?? '')
          .split(/[,;\s]+/)
          .map((e) => e.trim())
          .filter(Boolean)
      : cfg.email_recipients;
    if (to.length === 0)
      return { ok: false, message: input.test ? 'กรุณาระบุอีเมลที่จะส่งทดสอบ' : 'ยังไม่มีผู้รับที่บันทึกไว้' };
    if (input.test && to.length > 3) return { ok: false, message: 'ส่งทดสอบได้สูงสุด 3 อีเมล' };
    if (!to.every((e) => EMAIL_RE.test(e))) return { ok: false, message: 'รูปแบบอีเมลไม่ถูกต้อง' };
    if ((input.test ? testLimit : allLimit)(auth.userId)) {
      return {
        ok: false,
        message: input.test
          ? 'ส่งทดสอบถี่เกินไป — รอ 1 ชั่วโมงแล้วลองใหม่'
          : 'ส่งให้ผู้รับทั้งหมดได้ไม่เกิน 3 ครั้งต่อวัน',
      };
    }

    // A test is built from what the caller may see. Sending to every saved recipient is the
    // cron's fleet-wide email, so only someone who can see every plant may trigger it.
    if (!input.test && (await getSiteScope()) !== null) {
      return { ok: false, message: 'ส่งให้ผู้รับทั้งหมดได้เฉพาะผู้ที่เข้าถึงทุกโรงงาน — ใช้ส่งทดสอบแทน' };
    }
    const email = await buildWeeklyDigest(!input.test);
    const res = await sendEmail({
      to,
      subject: input.test ? `[ทดสอบ] ${email.subject}` : email.subject,
      html: email.html,
    });
    if (!res.ok) return { ok: false, message: res.message };
    await logAudit({
      action: 'SEND',
      table_name: 'weekly_digest',
      record_id: input.test ? 'test' : 'all',
      new_value: { to: to.length },
    });
    return { ok: true, message: res.message };
  });
}
