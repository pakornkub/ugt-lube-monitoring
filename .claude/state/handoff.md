# Handoff

Last updated: 2026-11-17

<!-- ของสด: งานถึงไหน คิวอะไรต่อ ติดคำถามอะไร — โหลดเข้า context ทุก session ผ่าน
     CLAUDE.md import · อัปเดตผ่าน /ugt-handoff ตอนจบทุก work chunk แล้ว commit
     ความรู้ถาวรไม่อยู่ไฟล์นี้ → docs/project-context/ · มติ → docs/adr/
     ห้ามใส่ secrets / ค่า .env — ไฟล์นี้ถูก commit -->

## In progress

- Nothing in progress — the code side is done, committed to pakornkub/ugt-lube-monitoring#1 (branch
  `org-standard-setup`). Waiting on the admin team (`docs/admin-handoff.md`). The LocalDB smoke DBs are
  dropped and `.env.local` is back to `CHANGE_ME` for the DB.

## Next (all wait on the admin team)

- (sent to the admin team 2026-11-16; **revised the same day** — one owner login, no shadow DB, two Jenkins
  jobs, no host cron: re-send the new version) Admin team returns the values in `docs/admin-handoff.md` → put
  them in `.env.local` → full system test on the real dev DB + Keycloak + SMTP (`/ugt-nextjs-system-test` live
  mode once that skill ships). Never tested here: real SSO login, SMTP delivery, Jenkins/Docker deploy, the
  compose `cron` service
- Jenkins/SonarQube job ready → push `develop` → 10 stages green → merge PR #1
- Not committed yet: the 2026-11-17 system-test fixes + the smoke files (`docker-compose.smoke.yml`,
  `smoke/`, `docs/project-context/system-test.md`, `.claude/launch.json`)
- `/ugt-contribute` the two kit bugs found by the system test: upload body cut at 10 MB by `proxy.ts`
  (`proxyClientMaxBodySize`), first-admin bootstrap writes no audit row (`admin.bootstrap`)

## Open Questions

- D1: a user with no role still sees the dashboard (all plants' data, no "waiting for a role" notice) — keep
  it, or show only the notice? (kit checklist says no data pages; the mail template says "general pages")
- D2: viewer opens Data Entry read-only (has `dataentry:read`) — confirm that is intended

## Done (newest first — keep only ~10; older history lives in git and board.md)

- 2026-11-17 System test, container mode (`docker-compose.smoke.yml`): 33 PASS · 3 FAIL fixed and re-run
  (upload 10–20 MB, standard editor shown as a raw id, `/admin/setup` without audit) · 2 decisions open ·
  BLOCKED: compose `cron` service (not in the smoke stack), Thai sort order

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
