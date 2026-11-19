# Architecture — as-built

<!-- แผนที่ระบบตามที่เป็นจริงตอนนี้ — ทุกข้อชี้ไฟล์/โฟลเดอร์จริง · อัปเดตผ่าน /ugt-handoff
     จุดที่จงใจต่างจากมาตรฐาน ugt-* แทรกตรงหัวข้อที่เกี่ยวด้วยป้าย "⚠ deviation:" · คุม ~150 บรรทัด
     DRAFT จาก scan 2026-11-15 หลังย้าย Supabase → SQL Server — ทีมช่วยตรวจ -->

Stack: Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 + shadcn base-mira ·
Prisma 7 → SQL Server (`@prisma/adapter-mssql`) · Better Auth (Keycloak SSO) · Chart.js ·
Vitest · Jenkins + Docker + SonarQube. basePath prod `/ugt-lube-monitoring`, dev `-dev`.

## Module map

- `app/(app)/` — หน้าในระบบ (Dashboard, Assets + Drill-down `assets/[id]`, Data Entry, Standards,
  Alarm Config, Reports, Admin) · `layout.tsx` = session gate + first-admin gate + shell
- `app/(auth)/login` — หน้า login (การ์ดเดิม + ปุ่ม SSO) · `app/(admin-setup)/admin/setup` — กดเป็น Admin คนแรก
- `app/(print)/print/report` — รายงานสำหรับพิมพ์/PDF
- `app/api/` — route handlers (ดู `api.md`) · `proxy.ts` — กันหน้าเมื่อไม่มี cookie + CSP nonce + security headers
- `components/layout/` — shell ของแอป (Sidebar มืด, Topbar, GlobalSearch, NotificationBell)
- `components/ui/` — kit (shadcn base-mira + org kit) ปนกับ primitives เดิมของแอป
  (`primitives.tsx`, `Modal.tsx`, `Toast.tsx`, `LoadingSkeletons.tsx`) ที่ภายในใช้ kit แล้ว
- `lib/queries/` (อ่าน) · `lib/actions/` (Server Actions เขียน) — ทุกตัวผ่าน `lib/prisma.ts`
- `lib/scoring/` — สูตร Health Score (`audit.ts`) + ตัวเขียนค่าลง DB (`recompute.ts`)
- `lib/parse/`, `lib/asset-match.ts`, `lib/asset-import.ts` — นำเข้า Excel ผลแล็บ/เครื่องจักร
- `lib/ai/` — AI diagnose/RCA/standard (GLM/OpenAI/Anthropic) + rule-based fallback
- `lib/email/` (เนื้อรายงาน/digest) · `lib/email.ts` + `lib/mail-templates.ts` (SMTP + dev mode, kit)
- `lib/storage.ts` + `app/api/files/**` — ไฟล์แนบบน Docker volume (`STORAGE_ROOT`)
- `lib/profile.ts` (ผู้ใช้ปัจจุบัน + "view as") · `lib/queries/permissions.ts` (สิทธิ์ + plant scope) ·
  `lib/actions/guards.ts` (`requirePermission` / `requireAssetPermission`)
- `prisma/schema.prisma` · `prisma/migrations/0_init` + `20261117000000_assets_health_range` (CHECK เขียนมือ — Prisma
  ประกาศไม่ได้) · `prisma/seed.ts` + `seed-data/reference.json` — Jenkins Deploy รัน `migrate deploy && db seed`
  ทุกครั้ง (seed เพิ่มเฉพาะที่ยังไม่มี ไม่ทับค่าที่ admin แก้) (2026-11-18)

## Data flow หลัก

- บันทึกผลตรวจ: `DataEntryClient` → `lib/actions/readings.ts:saveReading/saveOilBatch` → `OilReadings`/`VibReadings`
  → `lib/scoring/recompute.ts:computeHealth` → `Assets.Health/Status` (cache ที่ทุกหน้าอ่าน)
- แก้เกณฑ์: `AlarmClient` → `lib/actions/alarms.ts:saveAlarmConfig` → `AlarmParams`/`ScoreConfigs` → `recomputeAllHealth`
- Login: ปุ่ม SSO → Better Auth `genericOAuth` (Keycloak) → session hook ใน `lib/auth.ts` → `User` (+ `lib/after-login.ts`
  แจ้งแอดมินเมื่อยังไม่มี role) → `app/(app)/layout.tsx`
- ไฟล์แนบ: `lib/upload-client.ts` → `POST /api/files` → volume + `ReadingAttachments`/`StandardAttachments` ·
  ดาวน์โหลด `GET /api/files/<target>/<id>` (guard + 404)
- Weekly digest: compose `cron` service (busybox crond, prod only) → `POST /api/cron/weekly-digest` (Bearer `CRON_SECRET`) → `lib/email/weekly-digest-build.ts` → SMTP · ทุกวันจันทร์ 13:00 เวลาไทย (เจ้าของโปรเจคยืนยัน 2026-11-16)

## ตารางหลัก → feature

| ตาราง | ของ feature | หมายเหตุ |
| --- | --- | --- |
| `Assets` | เครื่องจักร 569 ตัว (seed) | `Health`/`Status` เขียนโดย `recompute.ts` เท่านั้น · CHECK `Assets_Health_ck` 0–100 |
| `OilReadings` · `VibReadings` | ผลตรวจรายเดือน | unique (AssetId, Period) |
| `AlarmParams` · `ScoreConfigs` · `AssetAlarmOverrides` · `AssetScoreOverrides` | เกณฑ์ + น้ำหนักคะแนน | |
| `MaintenanceRecords` | ประวัติซ่อม (drill-down) | |
| `Standards` · `StandardAttachments` | คลังมาตรฐาน | list = JSON ใน NVarChar(Max) |
| `ReadingAttachments` | ไฟล์ผลแล็บ | soft delete + sweep 90 วัน |
| `Sites` · `AssetTypes` | ข้อมูลอ้างอิง | |
| `NotificationConfigs` · `AppSettings` | ตั้งค่าอีเมล / เทมเพลตอีเมล | |
| `User` `Session` `Account` `Verification` `RateLimit` `Role` `Permission` `RolePermission` `ActivityLogs` | Better Auth + RBAC + audit | `ActivityLogs` เก็บ audit trail เดิมด้วย (TableName/RecordId/Old/NewValue) |

- ⚠ deviation: domain models ใช้ชื่อ field แบบ snake_case (`asset_id`, `vg_grade`) แทน camelCase — ให้ตรงกับ
  row types เดิมใน `lib/types.ts` ที่ทุกหน้าอ่าน; ชื่อคอลัมน์ใน DB ยังเป็น PascalCase (2026-11-15) — ADR 0002
- ⚠ deviation: ตารางโดเมนมี CreatedAt/UpdatedAt/CreatedBy/UpdatedBy แต่ไม่มี IsActive/IsDeleted (ยกเว้นตารางไฟล์แนบ)
  — ลบจริงแบบเดิม (ลบเครื่องจักร cascade ผลตรวจ) ประวัติอยู่ใน ActivityLogs; unique (AssetId, Period) ใช้กับ soft
  delete ไม่ได้ (2026-11-15)
- ⚠ deviation: ไม่มี SQL `compute_health` — สูตรเดียวคือ `lib/scoring/audit.ts` รันฝั่ง server ใน `recompute.ts` (2026-11-15) — ADR 0003
- ⚠ deviation: ไฟล์แนบใช้ตาราง FK ต่อเจ้าของ 2 ตาราง + route `/api/files/[target]/[id]` + สิทธิ์ `attachments:read/write`
  เดิม แทน `Attachments` polymorphic + `files:*` ของ kit (2026-11-15) — ADR 0004
- ⚠ deviation: หน้า admin users/roles/audit-logs/notifications เป็นของโปรเจคเอง (`lib/actions/users.ts`, `roles.ts`)
  ไม่ใช่ kit — มี site scope, เมนูต่อ role, "view as"; กันล็อกตัวเองด้วย `managersLeft` (2026-11-15)
- ⚠ deviation: `Sites` (PK `Code`), `AssetTypes` (PK `TypeName`), `AssetScoreOverrides` (PK `AssetId`) ใช้ natural key
  ไม่มีคอลัมน์ `Id` ตามแบบ Supabase เดิม (เจอใน `/code-review` 2026-11-18 — ยังไม่ได้ตัดสินว่าจะเพิ่ม `Id` ไหม)
- ⚠ deviation: `lib/base-path.ts` + `app/(auth)/login/sso-login-button.tsx` อ่าน `process.env.NEXT_PUBLIC_BASE_PATH`
  ตรง ๆ — ผ่าน `createEnv()` ได้ `''` ใน client bundle (2026-11-18)
- อีเมลรายงาน/digest ออกจาก `SMTP_FROM` เสมอ — หน้า `/admin/notifications` แสดงแบบอ่านอย่างเดียว · คอลัมน์
  `NotificationConfigs.FromEmail` ไม่ได้ใช้แล้วแต่คงไว้ (ไม่ต้อง migration ลบ) (2026-11-18) — ADR 0006

## Permissions

- คีย์ทั้งหมดใน `lib/permissions.ts` (`ALL_PERMISSIONS` + `DEFAULT_ROLES` = สิทธิ์ 4 role เดิม) · sync เข้า DB ที่
  `app/(app)/admin/layout.tsx` · plant scope (`User.SiteAccess`, ว่าง = ทุกโรงงาน, `system:bypass_site_access`) แทน RLS
  `can_access_site` เดิม → `lib/queries/permissions.ts:siteWhere/canAccessAsset`

## Testing map

- `npm test` (vitest, jsdom) · ข้าง ๆ โค้ด `*.test.ts` · สูตรคะแนน `lib/scoring/*.test.ts` · guard/สิทธิ์
  `lib/actions/guards.test.ts`, `lib/profile.test.ts` · ยังไม่มี test ที่ยิง SQL Server จริง
- ⚠ deviation: ESLint ตั้ง `react-hooks/set-state-in-effect|refs|purity` เป็น warn (โค้ดเดิม ~25 จุด + ไฟล์ kit) (2026-11-15)
