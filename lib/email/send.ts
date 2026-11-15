import 'server-only';
import { sendMail } from '@/lib/email';
import { buildDevBanner } from '@/lib/mail-templates';
import { isDevEnvironment } from '@/lib/environment';
import { getOwnPermissions, getSessionUser } from '@/lib/profile';

export interface EmailPayload {
  to: string[];
  /** Kept for existing callers; the relay sends as SMTP_FROM (an address it authorises). */
  from: string;
  subject: string;
  html: string;
}

// System mail with server-built HTML (exec-summary report, weekly digest) over the org SMTP
// relay (lib/email.ts). Not an admin-editable template: the body is a report the app renders.
// Dev mode still applies — a sender holding dev-mode:enable gets the mail instead of the real
// recipients, with the kit's banner naming them. Never throws: callers show the message.
export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; message: string }> {
  if (!payload.to.length) return { ok: false, message: 'No recipients' };

  const actor = await getSessionUser().catch(() => null); // the cron has no session
  const devMode = !!actor?.email && (await getOwnPermissions(actor.id)).includes('dev-mode:enable');
  const prefix = isDevEnvironment() || devMode ? '[DEV] ' : '';
  const subject = payload.subject.startsWith(prefix) ? payload.subject : prefix + payload.subject;

  try {
    if (devMode) {
      await sendMail({
        to: actor!.email,
        subject,
        html: buildDevBanner({ to: payload.to }) + payload.html,
      });
      return {
        ok: true,
        message: `DEV MODE — ส่งอีเมลหา ${actor!.email} แทนผู้รับ ${payload.to.length} ราย`,
      };
    }
    await sendMail({ to: payload.to, subject, html: payload.html });
    return { ok: true, message: `ส่งอีเมลไป ${payload.to.length} ผู้รับ` };
  } catch (error) {
    console.error('[email] send failed', error);
    const noRelay = error instanceof Error && error.message.includes('SMTP_HOST');
    return { ok: false, message: noRelay ? 'ยังไม่ได้ตั้งค่า SMTP (SMTP_HOST)' : 'ส่งอีเมลไม่สำเร็จ (SMTP)' };
  }
}
