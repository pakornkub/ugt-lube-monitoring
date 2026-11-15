// kit: ugt-nextjs-platform 4.46.0 · ugt-nextjs-design-setup/i18n/messages.ts
// kit-hash: 1ee96fefb75c
// Every namespace the kit ships, merged per locale. A skill that adds its own
// catalog (auth, mail, upload) registers it here — one import + one spread.
// Project-owned strings belong in messages/app.*.ts, NOT in a kit namespace:
// kit files are overwritten wholesale on plugin update.
import { kitEn } from '@/messages/kit.en';
import { kitTh } from '@/messages/kit.th';
import { authEn } from '@/messages/auth.en';
import { authTh } from '@/messages/auth.th';
import { mailEn } from '@/messages/mail.en';
import { mailTh } from '@/messages/mail.th';
import { appEn } from '@/messages/app.en';
import { appTh } from '@/messages/app.th';
import type { AppLocale } from '@/lib/format';

export type { AppLocale };

// โครงของ catalog มาจาก kit.th.ts โดยตรง (มติ 2.4 — "type safety แถม"): เพิ่ม
// namespace หรือ key ใน th แล้วลืมใส่ใน en จะพังตั้งแต่ตอน type-check ไม่ต้อง
// รอด่าน check-i18n.mjs · ค่าเป็น `string` ไม่ใช่ literal ของภาษาไทย ไม่งั้น
// kit.en.ts assign เข้าไม่ได้เลยสักตัว
type KitCatalog = {
  [Namespace in keyof typeof kitTh]: Record<keyof (typeof kitTh)[Namespace], string>;
};
type AuthCatalog = {
  [Namespace in keyof typeof authTh]: Record<keyof (typeof authTh)[Namespace], string>;
};
type AppCatalog = {
  [Namespace in keyof typeof appTh]: Record<keyof (typeof appTh)[Namespace], string>;
};
type MailCatalog = {
  [Namespace in keyof typeof mailTh]: Record<keyof (typeof mailTh)[Namespace], string>;
};

export const messages: Record<
  AppLocale,
  { kit: KitCatalog; auth: AuthCatalog; mail: MailCatalog; app: AppCatalog }
> = {
  th: { kit: kitTh, auth: authTh, mail: mailTh, app: appTh },
  en: { kit: kitEn, auth: authEn, mail: mailEn, app: appEn },
};

export const DEFAULT_LOCALE: AppLocale = 'th';
