# API Index

<!-- ตาราง endpoint — index ชี้เข้าโค้ด ไม่ใช่ spec เต็ม · อัปเดตผ่าน /ugt-handoff
     DRAFT จาก scan 2026-11-15 -->

| Method | Path | ทำอะไร | ไฟล์ | ใครเรียก |
| --- | --- | --- | --- | --- |
| GET/POST | `/api/auth/*` | Better Auth (SSO Keycloak callback, session) | `app/api/auth/[...all]/route.ts` | `lib/auth-client.ts` |
| GET | `/api/health` | healthcheck (ไม่ต้อง login) | `app/api/health/route.ts` | Docker/compose |
| POST | `/api/files` | อัปโหลดไฟล์แนบ (reading/standard) | `app/api/files/route.ts` | `lib/upload-client.ts` |
| GET | `/api/files/[target]/[id]` | ดาวน์โหลดไฟล์แนบแบบ guard | `app/api/files/[target]/[id]/route.ts` | `lib/actions/attachments.ts` (สร้าง URL) |
| GET | `/api/search` | ค้นหาเครื่องจักร (topbar) | `app/api/search/route.ts` | `components/layout/GlobalSearch.tsx` |
| GET | `/api/compare` | เทียบเครื่องจักร | `app/api/compare/route.ts` | `components/drilldown/DrillDownClient.tsx` |
| POST | `/api/ai/diagnose` · `/api/ai/rca` · `/api/ai/standard` | AI วินิจฉัย / RCA / ถามมาตรฐาน (+ fallback) | `app/api/ai/*/route.ts` | Drill-down, Standards |
| POST | `/api/cron/weekly-digest` | ส่งสรุปรายสัปดาห์ (Bearer `CRON_SECRET`) | `app/api/cron/weekly-digest/route.ts` | host cron |
| POST | `/api/cron/attachments-sweep` | ลบไฟล์แนบที่ถูกลบเกิน 90 วัน | `app/api/cron/attachments-sweep/route.ts` | host cron |

## Server Actions (`lib/actions/`)

| ไฟล์ | Actions หลัก |
| --- | --- |
| `readings.ts` | `saveReading` · `saveOilBatch` · `deleteReading` · `previewReading` · `getSavedReadings` · `getExistingOilKeys` |
| `assets.ts` | `createAsset` · `updateAsset` · `deleteAsset(s)` · `deleteAllAssets` · `importAssets` · `exportAssetsJson` |
| `alarms.ts` | `saveAlarmConfig` · `saveAssetAlarmOverride` · `deleteAssetAlarmOverride` · `applyWeightToAllOverrides` |
| `maintenance.ts` · `standards.ts` · `attachments.ts` | CRUD ประวัติซ่อม / มาตรฐาน / ไฟล์แนบ (ลบ = soft delete) |
| `users.ts` · `roles.ts` | role + plant ของผู้ใช้, ลบผู้ใช้ · role CRUD, สิทธิ์, เมนู |
| `notifications.ts` · `reports.ts` | ตั้งค่า/พรีวิว/ส่ง digest · ส่งรายงานทางอีเมล, บันทึกการแก้ข้อความรายงาน |
| `admin-setup.ts` · `admin-mail-templates.ts` · `auth.ts` | Admin คนแรก · เทมเพลตอีเมล (kit) · logout / SSO logout (kit) |
