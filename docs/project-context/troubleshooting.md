# Troubleshooting — เฉพาะโปรเจคนี้

<!-- อาการ → สาเหตุ → วิธีแก้ ของปัญหาที่เคยกินเวลาจริงในโปรเจคนี้ · เขียนผ่าน /ugt-handoff
     ทันทีที่ debug จบ (ตอนรายละเอียดยังสด)
     กติกาสำหรับ AI: เจอ error แปลก — เปิดไฟล์นี้ก่อนเริ่ม debug
     เลื่อนชั้น: ถ้าพิสูจน์ได้ว่าเป็นปัญหาระดับ stack (ทุกโปรเจคบน stack นี้เจอ)
     → `/ugt-contribute` เปิด PR ยกขึ้น skill เจ้าของใน platform repo แล้วลบออกจากที่นี่
     — ความรู้ไหลขึ้นทางเดียว ไม่เก็บซ้ำสองที่ -->

- **`next build` บน Windows พังด้วย Turbopack panic `powershell-utils … powershell.exe could not be resolved`**
  → `tedious` (driver ของ `@prisma/adapter-mssql`) ดึง `@azure/identity` → `open` เข้า bundle
  → `serverExternalPackages: ['@prisma/adapter-mssql', 'mssql', 'tedious']` ใน `next.config.ts` (2026-11-15)
- **`next build` ใน Git Bash: "basePath has to start with a /, found C:/Program Files/Git/…"**
  → MSYS แปลง `/ugt-lube-monitoring` เป็น path Windows → ใส่ `MSYS_NO_PATHCONV=1` นำหน้าคำสั่ง (Jenkins/Linux ไม่เจอ) (2026-11-15)
- **อยากเทสกับ SQL Server จริงในเครื่องโดยไม่มี Docker** → LocalDB รับแค่ named pipe แต่ `tedious` ต่อได้แค่ TCP
  → ทำ TCP proxy เล็ก ๆ (Node `net`) จาก `127.0.0.1:14330` ไปที่ pipe จาก `SqlLocalDB info MSSQLLocalDB`, สร้าง SQL login
  ใน LocalDB (mixed mode เปิดอยู่แล้ว) แล้วใช้ `encrypt=DANGER_PLAINTEXT` ใน `DATABASE_URL` — **ใช้เทสในเครื่องเท่านั้น** (2026-11-15)
- **`next/image` แบบ `unoptimized` แสดงรูปไม่ขึ้นใต้ basePath** → Next ไม่เติม basePath ให้ `src` ที่เป็น path ตรง
  → ใช้ `withBase('/logo.svg')` (`lib/base-path.ts`) เหมือน `fetch` / `<a href>` / `window.open` (2026-11-15)
- **แนบไฟล์ 10–20 MB แล้วได้ 500 / "อัปโหลดไม่สำเร็จ (network)"** — log: `Request body exceeded 10MB` → `Failed to parse body as FormData`
  → `proxy.ts` รันทุก request และ buffer body ได้แค่ 10 MB (ค่า default ของ Next) → `experimental.proxyClientMaxBodySize: '25mb'`
  ใน `next.config.ts` + route ตอบ 413 เมื่อ Content-Length เกิน `UPLOAD_MAX_BYTES` (2026-11-17, เจอใน system test container) — น่าเป็นของ kit upload-setup ทั้งชุด รอ `/ugt-contribute`
- **Vitest นับได้ไม่ครบ (เช่น 24/35 ไฟล์) + exit 1 ทั้งที่ไม่มี test fail** — `Timeout waiting for worker to respond`
  → เครื่องโหลดหนัก (รันคู่ lint / Docker stack) worker เปิดไม่ทัน → รัน `npx vitest run` เดี่ยว ๆ ไม่ใช่ test พัง (2026-11-17)
