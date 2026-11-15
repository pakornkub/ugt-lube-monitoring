import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { sendEmail } from '@/lib/email/send';
import { buildWeeklyDigest } from '@/lib/email/weekly-digest-build';
import { getNotificationConfig } from '@/lib/queries/notifications';

export const dynamic = 'force-dynamic';

// Host cron: POST /api/cron/weekly-digest with `Authorization: Bearer $CRON_SECRET`,
// every Monday (docs/admin-handoff.md cron table). No user session, so it reads the
// whole fleet, like a global admin view.
function authorized(request: Request): boolean {
  if (!env.CRON_SECRET) return false;
  const want = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const got = Buffer.from(request.headers.get('authorization') ?? '');
  return got.length === want.length && timingSafeEqual(got, want);
}

async function run(request: Request) {
  // Sends to real recipients — ALWAYS require the secret.
  if (!env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cfg = await getNotificationConfig();
    if (!cfg.enable_weekly_summary || !cfg.email_recipients.length) {
      return NextResponse.json({ ok: true, message: 'Weekly digest disabled or no recipients' });
    }

    const { subject, html } = await buildWeeklyDigest(true);
    const result = await sendEmail({
      to: cfg.email_recipients,
      from: cfg.from_email,
      subject,
      html,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('[cron] weekly-digest', e);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 });
  }
}

export const POST = run;
