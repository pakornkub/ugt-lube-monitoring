# Handoff

Last updated: 2026-11-15

<!-- ของสด: งานถึงไหน คิวอะไรต่อ ติดคำถามอะไร — โหลดเข้า context ทุก session ผ่าน
     CLAUDE.md import · อัปเดตผ่าน /ugt-handoff ตอนจบทุก work chunk แล้ว commit
     ความรู้ถาวรไม่อยู่ไฟล์นี้ → docs/project-context/ · มติ → docs/adr/
     ห้ามใส่ secrets / ค่า .env — ไฟล์นี้ถูก commit -->

## In progress

- Nothing in progress — the code side is done, committed to pakornkub/ugt-lube-monitoring#1 (branch
  `org-standard-setup`). Waiting on the admin team (`docs/admin-handoff.md`). The LocalDB smoke DBs are
  dropped and `.env.local` is back to `CHANGE_ME` for the DB.

## Next (all wait on the admin team)

- Admin team returns the values in `docs/admin-handoff.md` → put them in `.env.local` → full system test on the
  real dev DB + Keycloak + SMTP (`/ugt-nextjs-system-test` live mode once that skill ships). Never tested here:
  real SSO login, SMTP delivery, Jenkins/Docker deploy
- Jenkins/SonarQube job ready → push `develop` → 10 stages green → merge PR #1

## Open Questions

- Weekly digest time: Vercel ran it Monday 06:00 UTC; the handoff crontab uses 13:00 Bangkok
  (same instant). Confirm or move to 06:00 Bangkok. — owner: project owner
- Lab period labels still show the Buddhist year (`ต.ค. 69`); the org design contract says ค.ศ.
  Grandfathered in DESIGN.md §9 — decide whether to switch. — owner: project owner

## Done (newest first — keep only ~10; older history lives in git and board.md)

- 2026-11-15 Smoke test on SQL Server LocalDB + fixes: sidebar logo and sort link under basePath, "Last update" moves
  forward with new readings, batched recompute-all (6.4 s → 0.4 s), audit RecordId length, import keeps install date,
  files removed with their machine/standard, maintenance order, collation note in admin handoff
- 2026-11-15 `/ugt-nextjs-full-setup` (preserve mode): Next 16 / React 19 / Tailwind v4 ·
  Supabase → Prisma + SQL Server (Demo Mode + Local Store removed) · Better Auth SSO (Keycloak) +
  existing RBAC · shadcn base-mira kit + Inter/Noto Sans Thai · SMTP mail · attachments on a
  Docker volume · Vitest/ESLint/Prettier/husky · Jenkins + Docker + SonarQube
