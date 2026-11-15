# Handoff

Last updated: 2026-11-15

<!-- ของสด: งานถึงไหน คิวอะไรต่อ ติดคำถามอะไร — โหลดเข้า context ทุก session ผ่าน
     CLAUDE.md import · อัปเดตผ่าน /ugt-handoff ตอนจบทุก work chunk แล้ว commit
     ความรู้ถาวรไม่อยู่ไฟล์นี้ → docs/project-context/ · มติ → docs/adr/
     ห้ามใส่ secrets / ค่า .env — ไฟล์นี้ถูก commit -->

## In progress

- Org-standard migration done in code, **not yet run against a real SQL Server or Keycloak** —
  no DB/IdP reachable during the install (no Docker locally).

## Next

- Forward `docs/admin-handoff.md` to the admin team; put the returned values in `.env.local`
  (DATABASE_URL, SHADOW_DATABASE_URL, BETTER_AUTH_SECRET/URL, KEYCLOAK_*, SMTP_*, CRON_SECRET)
- First run on a real DB: `npx prisma migrate deploy` (0_init, written offline) → `npx prisma db seed`
  (569 machines + reference data) → log in → `/admin/setup` claims Administrator
- Smoke-test every page against the real DB (only type-checked + unit-tested so far)
- Push `develop` → Jenkins runs the 10 stages

## Open Questions

- Weekly digest time: Vercel ran it Monday 06:00 UTC; the handoff crontab uses 13:00 Bangkok
  (same instant). Confirm or move to 06:00 Bangkok. — owner: project owner
- Lab period labels still show the Buddhist year (`ต.ค. 69`); the org design contract says ค.ศ.
  Grandfathered in DESIGN.md §9 — decide whether to switch. — owner: project owner

## Done (newest first — keep only ~10; older history lives in git and board.md)

- 2026-11-15 `/ugt-nextjs-full-setup` (preserve mode): Next 16 / React 19 / Tailwind v4 ·
  Supabase → Prisma + SQL Server (Demo Mode + Local Store removed) · Better Auth SSO (Keycloak) +
  existing RBAC · shadcn base-mira kit + Inter/Noto Sans Thai · SMTP mail · attachments on a
  Docker volume · Vitest/ESLint/Prettier/husky · Jenkins + Docker + SonarQube
