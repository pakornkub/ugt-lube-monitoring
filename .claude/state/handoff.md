# Handoff

Last updated: 2026-11-19

<!-- ของสด: งานถึงไหน คิวอะไรต่อ ติดคำถามอะไร — โหลดเข้า context ทุก session ผ่าน
     CLAUDE.md import · อัปเดตผ่าน /ugt-handoff ตอนจบทุก work chunk แล้ว commit
     ความรู้ถาวรไม่อยู่ไฟล์นี้ → docs/project-context/ · มติ → docs/adr/
     ห้ามใส่ secrets / ค่า .env — ไฟล์นี้ถูก commit -->

## In progress

- Nothing in progress — PR pakornkub/ugt-lube-monitoring#1 merged into `main`; `develop` created from `main` 2026-11-19.
  Dev is deployed: https://ugtweb.ube.co.th/ugt-lube-monitoring-dev (Jenkins dev #2 — migrations + seed 569 machines,
  container healthy). Prod job `ugt-lube-monitoring` #2 failed at Deploy: credential `env-ugt-lube-monitoring` missing.

## Next

- Admin values are in `.env` / `.env.dev` / `.env.local` (2026-11-19). **`.env.local` still points at the prod DB
  `UGT_LubeMonitoring`** — switch it to `UGT_LubeMonitoring_DEV` before `npm run dev`. Then: first SSO login on dev →
  `/admin/setup`, full system test on dev (`/ugt-nextjs-system-test` live mode). Not tested yet: real SSO, SMTP
  delivery through the org relay, the compose `cron` service (prod only)
- Prod: admin adds Jenkins Secret file `env-ugt-lube-monitoring` (+ check `-dev`) → Build Now on the prod job
- Code-review leftovers (not fixed, none breaks the system): permission keys as string literals (~60 call
  sites, `requirePermission(perm: string)` in `lib/actions/guards.ts`) · audit actions `'INSERT'`/`'UPDATE'`
  as literals not `AUDIT_ACTIONS` · `saveReading` audits even when nothing changed · duplicated `authorized()`
  in both cron routes and table-only twins in `lib/actions/attachments.ts` · missing `Id` on 3 tables (see
  architecture.md ⚠ deviation)

## Open Questions

- None

## Done (newest first — keep only ~10; older history lives in git and board.md)

- 2026-11-19 OWASP leftovers on `develop`: `package.json` `overrides` pin `mysql2` ^3.24.6 (GHSA-3f6p-5ww8-9rcr,
  GHSA-rgwj-5xj2-c3m3 — pulled in by `better-auth` + `prisma`) and `deepmerge-ts` ^8.0.2 (GHSA-ggr8-5vv4-36mx — used
  by `@prisma/config` to merge `prisma.config.ts`; `prisma validate`/`generate` still work) · Sonar S2245: work-order
  default in `components/drilldown/MaintenanceTab.tsx` uses `crypto.getRandomValues` · drop the overrides once
  prisma/better-auth ship the fixed versions themselves

- 2026-11-19 OWASP fix on `develop`: `nodemailer` 7.0.13 → 10.6.0 (20 advisories, `@types/nodemailer` removed —
  v10 ships its own types; `lib/email.ts` unchanged) · `vite` 8.3.2 → 8.3.8 (test-only, 6 advisories) · checked with
  tsc, lint, full tests, build and a real SMTP send (3 recipients, Thai subject, attachment) to a local SMTP sink
- 2026-11-19 Plugin 4.93.0/4.93.1 env standard: `.env` + `.env.dev` created locally (gitignored, fresh
  `BETTER_AUTH_SECRET`/`CRON_SECRET` per file, URLs on `https://ugtweb.ube.co.th`, DB user/password + Keycloak
  secret `CHANGE_ME`) · `.env.local` + `.env.example`: `KEYCLOAK_ISSUER=…/keycloak/realms/ugt`, client
  `ugt-lube-monitoring-dev`, app name `(DEV)` · `Jenkinsfile`: dev build bakes `NEXT_PUBLIC_APP_NAME … (DEV)`,
  app URL on ugtweb · `docs/admin-handoff.md` table G = 2 Keycloak clients, return table asks 2 secrets
- 2026-11-18 DBA script `docs/admin-db-setup.sql` (ADR 0009): one SQL Server for prod + dev, owner login `db_owner`
  + `dbcreator`, default DB `UGT_LubeMonitoring_DEV`, same shape as `ugt-rd-laboratory` (SQLCMD mode, idempotent,
  `Thai_CI_AS`, RCSI ON, Recovery FULL, compat 150 = SQL Server 2019+, login/password stay `CHANGE_ME`) · table A
  of `docs/admin-handoff.md` links it · dev DB renamed `_DEV` · not run on a SQL Server yet
- 2026-11-18 Owner decisions (ADR 0008): D1 keep — no-role users still see the dashboard · Spec 5 keep — oil-change
  due stays `last_update + oil_change_months` · kit sync 4.89.0 → 4.91.1 (`lib/org-email.ts` + test from the kit,
  `audit-actions.ts`/`admin-setup.ts` restamped, `ORG_EMAIL_DOMAINS=ube.co.th,ube.com` in `.env.example`) —
  plugin PR #70 was merged and released in 4.91.0

- 2026-11-18 `/code-review` of PR #1 (Standards + Spec) → fixed in `c0d0ed8`: deploy runs `prisma db seed`
  (`Jenkinsfile`) · CHECK `Assets_Health_ck` 0–100 (new migration) · `/admin/audit` → 308 `/admin/audit-logs`
  (`next.config.ts`) · download 404 without `attachments:read` (+ `route.test.ts`) · `/admin/notifications`
  shows `SMTP_FROM` read-only, `EmailPayload.from` removed · `saveOilBatch` hides raw DB errors. Re-tested in
  the smoke stack (seed re-run adds 0, real PDF round-trip identical SHA-256)
- 2026-11-18 D2 closed: the owner's role matrix gives Viewer every menu incl. Data Entry (read-only) —
  `DEFAULT_ROLES` in `lib/permissions.ts` matches the matrix row for row
- 2026-11-17 System test, container mode (`docker-compose.smoke.yml`): 33 PASS · 3 FAIL fixed and re-run
  (upload 10–20 MB, standard editor shown as a raw id, `/admin/setup` without audit) · BLOCKED: compose `cron`
  service (not in the smoke stack), Thai sort order
- 2026-11-16 Org infra rules (ADR 0007): no shadow DB, owner login for prod+dev, two Jenkins Pipeline jobs,
  scheduled jobs in the compose `cron` service (busybox crond), nginx described in words · kit sync to 4.89.0
