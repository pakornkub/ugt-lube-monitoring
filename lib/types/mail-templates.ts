// kit: ugt-nextjs-platform 4.79.0 · ugt-nextjs-mail-setup/lib/types/mail-templates.ts
// kit-hash: 1e2c60395cd8
// source: ugt-hrms lib/types/mail-templates.ts — generalized by ugt-nextjs-mail-setup
// (HR workflows removed; the three keys below are a working approval example —
// rename them to your domain and add more.)
import { z } from 'zod';

/**
 * Master mail templates — subject + editable HTML body per workflow email,
 * editable from `/admin/mail-templates`. Defaults live in code
 * (`DEFAULT_MAIL_TEMPLATES`); an admin override is stored as one `AppSettings`
 * row keyed `mailTemplate:<key>`. With no override the in-code default is used,
 * so mail works the moment the skill is installed — nothing to seed.
 *
 * Bodies use `{{token}}` placeholders substituted at send time. Values are
 * HTML-escaped, so a user-typed reason can never inject markup into an email.
 */

// ─── Keys ───────────────────────────────────────────────────────────────────

export const MAIL_TEMPLATE_KEYS = [
  // ใช้โดย lib/after-login.ts (ugt-nextjs-auth-setup) — แจ้งแอดมินเมื่อมีคน SSO/LDAP
  // login แล้วยังไม่มีบทบาท ครั้งเดียวต่อคน · ลบได้เมื่อโปรเจคมีแต่ local login
  'auth.user-without-role',
] as const;

export type MailTemplateKey = (typeof MAIL_TEMPLATE_KEYS)[number];

/** AppSettings row key holding a stored override. */
export function mailTemplateSettingKey(key: MailTemplateKey): string {
  return `mailTemplate:${key}`;
}

// ─── Schema ─────────────────────────────────────────────────────────────────

/** Errors are CODES, not translated text — the UI translates via the
 *  `mail.errors` catalog namespace (the server action that validates has no
 *  i18n context). */
export const mailTemplateSchema = z.object({
  subject: z.string().min(1, 'SUBJECT_REQUIRED').max(300, 'SUBJECT_TOO_LONG'),
  html: z.string().min(1, 'BODY_REQUIRED').max(20000, 'BODY_TOO_LONG'),
});

export type MailTemplateErrorCode =
  'SUBJECT_REQUIRED' | 'SUBJECT_TOO_LONG' | 'BODY_REQUIRED' | 'BODY_TOO_LONG';

export type MailTemplate = z.infer<typeof mailTemplateSchema>;

// ─── Definitions (editor metadata + allowed tokens) ──────────────────────────

/** Status banner above the editable content. */
export interface MailBannerSpec {
  /** `{{token}}` whose value becomes the banner text. */
  token: string;
  tone: 'success' | 'danger';
}

/** Call-to-action button below the editable content. */
export interface MailCtaSpec {
  label: string;
  /** `{{token}}` whose value is the button href. */
  urlToken: string;
}

export interface MailTemplateDefinition {
  key: MailTemplateKey;
  /** Workflow this template belongs to — groups the editor's selector.
   *  i18n key under `mail.templates` (see messages/mail.th.ts), resolved to
   *  display text by the Server Component page (`getTranslations`) — this
   *  array sits at module scope so it cannot call useTranslations itself. */
  menuKey: string;
  labelKey: string;
  descriptionKey: string;
  /** Allowed `{{token}}` names — drives editor hints and the preview. */
  variables: string[];
  /**
   * Subset of `variables` whose value is pre-built, already-safe HTML and must
   * NOT be escaped at send time (e.g. a server-built table).
   * **Never put a user-controlled value in here.**
   */
  htmlVariables?: readonly string[];
  /** Overrides merged over the preview sample. */
  previewSample?: Record<string, string>;
  // ── Fixed chrome (assembled by composeEmail — not editable) ───────────────
  /** Topic in the email header (h1). */
  heading: string;
  banner?: MailBannerSpec;
  cta?: MailCtaSpec;
}

/** `{{recipientName}}` of a mail sent to every admin at once (`auth.user-without-role`,
 *  from lib/after-login.ts) — email body wording, so it lives here with the defaults
 *  and not in the auth kit file. */
export const ADMIN_RECIPIENT_NAME = 'ผู้ดูแลระบบ';

export const MAIL_TEMPLATE_DEFINITIONS: MailTemplateDefinition[] = [
  {
    key: 'auth.user-without-role',
    menuKey: 'menuAccount',
    labelKey: 'userWithoutRoleLabel',
    descriptionKey: 'userWithoutRoleDescription',
    heading: 'มีผู้ใช้ใหม่ยังไม่มีบทบาท',
    variables: ['appName', 'recipientName', 'userName', 'userEmail', 'usersUrl'],
    previewSample: {
      recipientName: ADMIN_RECIPIENT_NAME,
      userName: 'สมหญิง ตั้งใจ',
      userEmail: 'somying.t@example.com',
      usersUrl: 'https://APP_HOST/ugt-lube-monitoring/admin/users?tab=no-role',
    },
    cta: { label: 'กำหนดบทบาท →', urlToken: 'usersUrl' },
  },
  // EXTENSION POINT: add this project's templates here, then add the matching
  // key to MAIL_TEMPLATE_KEYS, a default to DEFAULT_MAIL_TEMPLATES, and the
  // matching menuKey/labelKey/descriptionKey entries to
  // messages/mail.{th,en}.ts's `templates` namespace (looked up dynamically,
  // so check-i18n's key-parity check won't catch a missing one for you).
];

export const MAIL_TEMPLATE_DEFINITION_BY_KEY: Record<MailTemplateKey, MailTemplateDefinition> =
  Object.fromEntries(MAIL_TEMPLATE_DEFINITIONS.map((d) => [d.key, d])) as Record<
    MailTemplateKey,
    MailTemplateDefinition
  >;

/** Base sample values for the editor preview (per-template overrides merge on top). */
export const MAIL_TEMPLATE_PREVIEW_SAMPLE_BASE: Record<string, string> = {
  appName: 'UGT Reliability Lube Monitoring',
  recipientName: 'สมชาย ใจดี',
};

// ─── Fixed chrome ────────────────────────────────────────────────────────────
// Card frame, header, greeting, banner, CTA, divider and footer are FIXED and
// assembled by `composeEmail` at render time — they are NOT part of the editable
// template, so an admin cannot break the layout or delete the disclaimer.
// Email clients do not support CSS variables: every colour here is literal hex.
// Keep #0066cc in step with the project's primary in DESIGN.md.

const HEADER_COLOR = '#0066cc';
const PAGE_BG = '#f4f5f7';
const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";

const EMAIL_HEADER = (heading: string) =>
  `<tr><td style="background-color:${HEADER_COLOR};padding:24px 32px">` +
  `<p style="margin:0;font-size:11px;color:#dbeafe;letter-spacing:0.08em;text-transform:uppercase">{{appName}}</p>` +
  `<h1 style="margin:6px 0 0;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3">${heading}</h1>` +
  `</td></tr>`;

const GREETING = `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151">เรียนคุณ <strong>{{recipientName}}</strong>,</p>`;

const EMAIL_FOOTER =
  `<tr><td style="padding:0 32px"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0"></td></tr>` +
  `<tr><td style="padding:20px 32px 28px">` +
  `<p style="margin:0 0 4px;font-size:11px;color:#9ca3af">อีเมลฉบับนี้จัดส่งโดยอัตโนมัติจากระบบ {{appName}} — กรุณาอย่าตอบกลับอีเมลนี้โดยตรง</p>` +
  `<p style="margin:0;font-size:11px;color:#9ca3af">หากพบปัญหาหรือต้องการข้อมูลเพิ่มเติม กรุณาติดต่อ ทีม Reliability Engineering (ผู้ดูแลระบบ)</p>` +
  `</td></tr>`;

const BANNER_TONE = {
  success: { bg: '#f0fdf4', border: '#22c55e', color: '#16a34a' },
  danger: { bg: '#fef2f2', border: '#ef4444', color: '#dc2626' },
} as const;

function bannerHtml(banner: MailBannerSpec): string {
  const tone = BANNER_TONE[banner.tone];
  return (
    `<div style="margin:0 0 20px;padding:12px 16px;background:${tone.bg};border-left:4px solid ${tone.border};border-radius:6px">` +
    `<p style="margin:0;color:${tone.color};font-weight:600;font-size:15px">{{${banner.token}}}</p></div>`
  );
}

function ctaHtml(cta: MailCtaSpec): string {
  return (
    `<div style="margin-top:8px"><a href="{{${cta.urlToken}}}" target="_blank" ` +
    `style="display:inline-block;background:${HEADER_COLOR};color:#fff;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:13px;font-weight:600">` +
    `${cta.label}</a></div>`
  );
}

/**
 * Assemble the full email from fixed chrome + editable content.
 * `{{token}}` placeholders survive composition and are substituted at send time.
 * Layout: page wrapper → card → header → body[greeting → banner → content → cta]
 *         → divider → footer.
 */
export function composeEmail(def: MailTemplateDefinition, contentHtml: string): string {
  return [
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BG};padding:32px 16px;font-family:${FONT};color:#1a1a2e">`,
    '<tr><td align="center">',
    `<table width="760" cellpadding="0" cellspacing="0" border="0" style="max-width:760px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.1)">`,
    EMAIL_HEADER(def.heading),
    `<tr><td style="padding:28px 32px 8px;font-size:14px;line-height:1.6;color:#374151">`,
    GREETING,
    def.banner ? bannerHtml(def.banner) : '',
    contentHtml,
    def.cta ? ctaHtml(def.cta) : '',
    '</td></tr>',
    EMAIL_FOOTER,
    '</table>',
    '</td></tr>',
    '</table>',
  ].join('');
}

// ─── Default templates (editable content only) ───────────────────────────────

export const DEFAULT_MAIL_TEMPLATES: Record<MailTemplateKey, MailTemplate> = {
  // ส่งจาก lib/after-login.ts ถึงทุกคนที่ถือ users:update — ปุ่มไปแท็บ "ยังไม่มีบทบาท" เป็น chrome
  'auth.user-without-role': {
    subject: '[{{appName}}] {{userName}} เข้าระบบแล้วแต่ยังไม่มีบทบาท',
    html: [
      '<p>มีผู้ใช้เข้าสู่ระบบเป็นครั้งแรกและยังไม่ได้รับบทบาท จึงยังใช้งานได้เฉพาะหน้าทั่วไป</p>',
      '<p><strong>ชื่อ:</strong> {{userName}}<br><strong>อีเมล:</strong> {{userEmail}}</p>',
      '<p>อีเมลนี้ส่งครั้งเดียวต่อผู้ใช้',
      '</p>',
    ].join(''),
  },
};
