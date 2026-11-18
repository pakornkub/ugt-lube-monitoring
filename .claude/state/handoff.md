# Handoff

Last updated: 2026-11-18

<!-- ของสด: งานถึงไหน คิวอะไรต่อ ติดคำถามอะไร — โหลดเข้า context ทุก session ผ่าน
     CLAUDE.md import · อัปเดตผ่าน /ugt-handoff ตอนจบทุก work chunk แล้ว commit
     ความรู้ถาวรไม่อยู่ไฟล์นี้ → docs/project-context/ · มติ → docs/adr/
     ห้ามใส่ secrets / ค่า .env — ไฟล์นี้ถูก commit -->

## In progress

- Nothing in progress — PR pakornkub/ugt-lube-monitoring#1 (branch `org-standard-setup`) pushed at `c0d0ed8`;
  `/code-review` done. Waiting on the admin team (`docs/admin-handoff.md`). Smoke stack is down (`down -v`).

## Next

- **Re-send `docs/admin-handoff.md`** to the admin team — changed again 2026-11-18 (deploy now seeds plants,
  asset types and the 569 machines). Then: admin values → `.env.local` → full system test on real dev DB +
  Keycloak + SMTP (`/ugt-nextjs-system-test` live mode). Never tested here: real SSO, SMTP delivery,
  Jenkins/Docker deploy (incl. `db seed` step in `Jenkinsfile`), the compose `cron` service
- Jenkins/SonarQube job ready → push `develop` → 10 stages green → merge PR #1
- Code-review leftovers (not fixed, none breaks the system): permission keys as string literals (~60 call
  sites, `requirePermission(perm: string)` in `lib/actions/guards.ts`) · audit actions `'INSERT'`/`'UPDATE'`
  as literals not `AUDIT_ACTIONS` · `saveReading` audits even when nothing changed · duplicated `authorized()`
  in both cron routes and table-only twins in `lib/actions/attachments.ts` · missing `Id` on 3 tables (see
  architecture.md ⚠ deviation)

## Open Questions

- None

## Done (newest first — keep only ~10; older history lives in git and board.md)

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
- 2026-11-16 Owner decisions: weekly digest stays Monday 13:00 Bangkok; lab period labels keep the Buddhist year (DESIGN.md §10)
- 2026-11-15 Smoke test on SQL Server LocalDB + fixes: sidebar logo and sort link under basePath, "Last update" moves
  forward with new readings, batched recompute-all (6.4 s → 0.4 s), audit RecordId length, import keeps install date,
  files removed with their machine/standard, maintenance order, collation note in admin handoff
- 2026-11-15 `/ugt-nextjs-full-setup` (preserve mode): Next 16 / React 19 / Tailwind v4 ·
  Supabase → Prisma + SQL Server (Demo Mode + Local Store removed) · Better Auth SSO (Keycloak) +
  existing RBAC · shadcn base-mira kit + Inter/Noto Sans Thai · SMTP mail · attachments on a
  Docker volume · Vitest/ESLint/Prettier/husky · Jenkins + Docker + SonarQube
