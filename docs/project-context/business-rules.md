# Business Rules — as-built

<!-- กติกา business ที่ระบบ "ทำจริงตอนนี้" — ทุกข้อชี้โค้ดที่ implement · มติ → docs/adr/
     DRAFT จาก scan 2026-11-15 — ข้อที่อนุมานเองมีป้าย (assumption) -->

## Health Score

- สูตรเดียว คิดฝั่ง server เท่านั้น; ทุกหน้าอ่าน `Assets.Health/Status` — `lib/scoring/audit.ts:getDeductionBreakdown`,
  เขียนโดย `lib/scoring/recompute.ts:computeHealth/recomputeAllHealth` (ADR 0003, PRD §6)
- สถานะ: `<40` Critical · `<80` Warning · `≥80` Healthy — `lib/scoring/health.ts:statusFromHealth`
- ใช้ผลตรวจงวดล่าสุด (period มากสุด แล้ว created ล่าสุด) ของน้ำมันและสั่นแยกกัน — `recompute.ts:scoreAsset`
- VG 0 = ไม่มีเกรด VG → ความหนืดเทียบเกณฑ์ทั่วไปใน `AlarmParams` — `lib/viscosity-limits.ts`
- บันทึก/ลบผลตรวจ, แก้ VG หรือ override → คิดใหม่เครื่องนั้น; บันทึกเกณฑ์ → คิดใหม่ทั้งหมด — `lib/actions/readings.ts`, `alarms.ts`

## ผลตรวจ / นำเข้า Excel

- งวดในอนาคตบันทึกไม่ได้ — `lib/parse/period.ts:isFuturePeriod`
- ไม่สร้างเครื่องจักรอัตโนมัติจาก TAG ในไฟล์แล็บ; TAG ตรง/normalize ตรงตัวเดียวเท่านั้นที่เลือกให้ — `lib/asset-match.ts:matchTag`
- ช่องว่าง ≠ 0; ไฟล์ที่ไม่มีคอลัมน์ไม่เขียน null ทับ; งวดที่มีผลแล้วรอ "ยืนยันทับ" — `lib/actions/readings.ts:saveOilBatch`
- Cu / Si ไม่รับและไม่คิดคะแนนแล้ว (คอลัมน์ยังอยู่) — `lib/reading-fields.ts`

## สิทธิ์ / ผู้ใช้

- บัญชีเกิดเองตอน login SSO ครั้งแรก (ไม่มีหน้าสมัคร); ยังไม่มี role = ใช้งานไม่ได้จนแอดมินกำหนด — `lib/auth.ts`, `app/(app)/admin/users`
- คนแรกที่ login กด `/admin/setup` เป็น Admin + สร้าง 4 role เดิม — `lib/actions/admin-setup.ts`
- ต้องมีผู้ใช้ที่ถือ `users:manage` อย่างน้อย 1 คนเสมอ — `lib/actions/roles.ts:setRolePermissions` (managersLeft)
- role ระบบ (admin/engineer/manager/viewer) ลบไม่ได้ — `lib/actions/roles.ts:deleteRole`
- เห็นได้เฉพาะโรงงานใน `SiteAccess` (ว่าง = ทุกโรงงาน) — `lib/queries/permissions.ts:siteWhere`
- "view as" แสดงผลเท่านั้น ไม่เปลี่ยนสิทธิ์จริงของ action — `lib/profile.ts`, `lib/actions/guards.ts`

## ไฟล์แนบ / อีเมล

- ผลแล็บ: PDF/XLSX/XLS/CSV ≤ 10 MB · มาตรฐาน: PDF/DOC(X)/XLSX/PNG/JPG ≤ 20 MB — `lib/attachment-rules.ts`
- ลบไฟล์ = soft delete, ไบต์จริงลบหลัง 90 วัน — `app/api/cron/attachments-sweep/route.ts`
- ส่งรายงานอีเมล ≤ 10 ครั้ง/ชม./คน, ผู้รับ ≤ 5 — `lib/actions/reports.ts:sendReportEmail`
- ผู้ถือ `dev-mode:enable` ได้อีเมลแทนผู้รับจริง — `lib/email/send.ts`, `lib/email.ts`
