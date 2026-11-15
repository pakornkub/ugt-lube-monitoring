# 0006 — Report and digest emails are system mail, not admin-editable templates

Date: 2026-11-15 · Status: accepted

Mail moved from Resend to the org SMTP relay (`lib/email.ts`). The executive-summary report and the weekly
digest are rendered by the app (tables, numbers) in `lib/email/*`, so they are sent with `sendMail` through
`lib/email/send.ts`, which still applies dev mode (`dev-mode:enable` → mail goes to the sender, `[DEV] `
subject). Only the "user logged in without a role" notice uses an admin-editable template
(`/admin/mail-templates`).
