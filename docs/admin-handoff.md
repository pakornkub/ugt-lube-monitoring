# คำขอตั้งค่าระบบ — UGT Reliability Lube Monitoring (`ugt-lube-monitoring`)

ผู้ขอ: pakornkub (ทีมพัฒนา) · 2026-11-15 (แก้ไข 2026-11-19) · repo: `https://github.com/pakornkub/ugt-lube-monitoring.git`
**ทำเสร็จแล้ว กรอกตาราง "ส่งกลับ" ท้ายไฟล์ แล้วส่งไฟล์นี้คืนทีมพัฒนา** · ชื่อทุกตัวต้องพิมพ์ตามนี้เป๊ะ

## ขั้นตอนรวม

| # | ใครทำ | ระบบ | ทำอะไร | ดูตาราง |
| --- | --- | --- | --- | --- |
| 1 | DBA | SQL Server | รัน script ในตาราง A — database 2 ตัว + login ของเจ้าของโปรเจค 1 ตัว (ใช้ทั้ง prod และ dev) | [A](#a-sql-server--database--login) |
| 2 | Admin | Server (Docker host) | เตรียม folder เก็บไฟล์ + ตั้ง backup | [B](#b-server--folder-เก็บไฟล์) |
| 3 | Admin | Jenkins | สร้าง credential | [C](#c-jenkins--credentials) |
| 4 | Admin | Jenkins | สร้าง pipeline job 2 ตัว (prod / dev แยกกัน) | [D](#d-jenkins--pipeline-job-prod--dev) |
| 5 | Admin | GitHub | ตั้ง webhook ไป Jenkins | [E](#e-github--webhook) |
| 6 | Admin | SonarQube | สร้าง 2 project + Quality Gate + webhook | [F](#f-sonarqube) |
| 7 | Admin | Keycloak | สร้าง client SSO 2 ตัว (prod / dev) | [G](#g-keycloak--client-sso) |
| 8 | Admin | Nginx | สร้าง reverse proxy ของโปรเจค | [H](#h-nginx--reverse-proxy) |
| 9 | ทุกคน | — | ส่งค่ากลับทีมพัฒนา | [ส่งกลับ](#ส่งกลับ) |

> job ตั้งเวลา (weekly digest, ลบไฟล์แนบเก่า) รันใน container `ugt-lube-monitoring-cron` ซึ่ง deploy มาพร้อมแอป — **ไม่ต้องตั้ง cron บน server**

---


### A. SQL Server — Database + Login

**รัน script ครั้งเดียวจบ — ไม่ต้องสร้างอะไรด้วยมือ** · login ใช้ SQL authentication

| Server | รัน script |
| --- | --- |
| prod + dev (เครื่องเดียวกัน) | [`admin-db-setup.sql`](admin-db-setup.sql) |

1. SSMS → เปิด script → เมนู **Query → SQLCMD Mode** (ต้องเปิด ไม่งั้น `:setvar` error)
2. แทน `CHANGE_ME` ใน 2 บรรทัดบนสุด: `LoginName` (ตามมาตรฐานชื่อ login ขององค์กร) · `LoginPassword` (ห้ามมี `'`) — กรอกตอนรันเท่านั้น ปิดไฟล์โดยไม่ save
3. F5 → ผลตรวจท้าย script ต้องเป็น `1` ทุกคอลัมน์ → แจ้งชื่อ login ในตารางส่งกลับ (รหัสส่งช่องทางปลอดภัย)

| script สร้าง | ชื่อ | สิทธิ์ |
| --- | --- | --- |
| Database prod · dev — collation `Thai_CI_AS` · Read Committed Snapshot `ON` · Recovery model `Full` · Compatibility level `150` · Containment `None` | `UGT_LubeMonitoring` · `UGT_LubeMonitoring_DEV` | — |
| Login ของเจ้าของโปรเจค (pakornkub) — **ตัวเดียว ใช้ทั้ง prod และ dev** · default database `UGT_LubeMonitoring_DEV` | ตาม `LoginName` | `db_owner` ใน database ทั้ง 2 ตัว · server role `dbcreator` |

> `dbcreator`: ตอนสร้าง migration Prisma สร้าง database ชั่วคราวแล้วลบเอง (ไม่ต้องสร้าง shadow database ไว้)
>
> ⚠️ Recovery model `Full` → **ต้องตั้ง job backup transaction log ของทั้ง 2 database** ไม่งั้นไฟล์ log โตไม่หยุดจน disk เต็ม
>
> ตารางและข้อมูลตั้งต้น (โรงงาน ประเภทเครื่อง เครื่องจักร 569 เครื่อง) สร้างเองตอน deploy (pipeline รัน migration + seed) — DBA ไม่ต้องสร้างตาราง · Compatibility level `150` = SQL Server 2019 ขึ้นไป


### B. Server — Folder เก็บไฟล์

ที่: **Docker host (prod และ dev)**

| Folder | ใครสร้าง | Admin ต้องทำ |
| --- | --- | --- |
| `/home/docker02/appdata` | Admin — **ครั้งเดียวต่อ server** | `sudo mkdir -p /home/docker02/appdata && sudo chown jenkins:jenkins /home/docker02/appdata` |
| `/home/docker02/appdata/ugt-lube-monitoring/storage` | pipeline สร้างเองตอน deploy | **ตั้ง backup job** — ข้อมูลอยู่ที่นี่ที่เดียว ไม่อยู่ใน DB backup · ห้ามลบ folder นี้ |
| `/home/docker02/appdata/ugt-lube-monitoring-dev/storage` | pipeline สร้างเองตอน deploy | ไม่ต้อง backup |


### C. Jenkins — Credentials

ที่: **Manage Jenkins → Credentials → System → Global → Add Credentials**

| ID (พิมพ์ตามนี้) | Kind | ใส่อะไร |
| --- | --- | --- |
| `env-ugt-lube-monitoring` | Secret file | ไฟล์ `.env` ของ **prod** (ทีมพัฒนาส่งให้ทางช่องทางปลอดภัย) |
| `env-ugt-lube-monitoring-dev` | Secret file | ไฟล์ `.env` ของ **dev** — ห้ามใช้ไฟล์เดียวกับ prod |
| `nvd` | Secret text | NVD API key (ฟรีที่ nvd.nist.gov) — ใช้ร่วมทุกโปรเจคบน server |

### D. Jenkins — Pipeline job (prod / dev)

ที่: **Dashboard → New Item** · สร้าง **2 job แยกกัน** (ไม่ใช้ Multibranch)

| ช่อง | job prod | job dev |
| --- | --- | --- |
| Item name | `ugt-lube-monitoring` | `ugt-lube-monitoring-dev` |
| Type | Pipeline | Pipeline |
| Build Triggers | GitHub hook trigger for GITScm polling | 〃 |
| Pipeline → Definition | Pipeline script from SCM → Git | 〃 |
| Repository URL | `https://github.com/pakornkub/ugt-lube-monitoring.git` | 〃 |
| Branch Specifier | `*/main` | `*/develop` |
| Script Path | `Jenkinsfile` | `Jenkinsfile` |
| Lightweight checkout | **ปิด** (เปิดไว้ stage แรกพัง) | **ปิด** |

> สร้างเสร็จกด **Build Now** ให้แต่ละ job 1 ครั้ง — GitHub hook trigger เริ่มทำงานหลัง job รันครั้งแรกเท่านั้น

### E. GitHub — Webhook

ที่: **repo → Settings → Webhooks → Add webhook**

| ช่อง | ใส่ค่า |
| --- | --- |
| Payload URL | `http://<jenkins-host>:8080/github-webhook/` |
| Content type | `application/json` |
| Events | Just the push event |

### F. SonarQube

| ที่ | ช่อง | ใส่ค่า |
| --- | --- | --- |
| Administration → Projects → Create | Project key / Display name | `ugt-lube-monitoring` / UGT Reliability Lube Monitoring |
| 〃 | Project key / Display name | `ugt-lube-monitoring-dev` / UGT Reliability Lube Monitoring (Dev) |
| Project Settings → Quality Gate | Gate | มาตรฐานองค์กร — ผูก**ทั้ง 2 project** |
| Administration → Configuration → Webhooks → Create | URL | `http://<jenkins-host>:8080/sonarqube-webhook/` (ไม่ตั้ง = pipeline ค้างตลอด) |


### G. Keycloak — Client (SSO)

ที่: **realm `ugt` → Clients → Create client** — **2 client** (prod / dev) ตั้งค่าเหมือนกัน ต่างแค่ Client ID กับ redirect URI

| ช่อง | client prod | client dev |
| --- | --- | --- |
| Client type | OpenID Connect | 〃 |
| Client ID | `ugt-lube-monitoring` | `ugt-lube-monitoring-dev` |
| Client authentication | On | 〃 |
| Standard flow | On · ช่องอื่น (Direct access / Implicit / Service accounts) **Off** | 〃 |
| Valid redirect URIs | `https://ugtweb.ube.co.th/ugt-lube-monitoring/api/auth/callback/keycloak` | `https://ugtweb.ube.co.th/ugt-lube-monitoring-dev/api/auth/callback/keycloak` |
| 〃 (บรรทัดที่ 2) | — | `http://localhost:3000/ugt-lube-monitoring-dev/api/auth/callback/keycloak` (เครื่องนักพัฒนา) |
| Web origins | `+` | `+` |
| Advanced → PKCE Method | S256 | S256 |


### H. Nginx — Reverse proxy

Admin สร้าง reverse proxy ของโปรเจคตามรูปแบบที่ใช้กับโปรเจคอื่นบน server ให้ครอบคลุมข้อต่อไปนี้:

- path `/ugt-lube-monitoring` → แอป prod (port `APP_PORT` prod) และ path `/ugt-lube-monitoring-dev` → แอป dev (port `APP_PORT` dev)
- ขนาด request ต้องรับไฟล์แนบได้ถึง **25 MB** (ถ้าไม่ตั้ง อัปโหลดไฟล์ใหญ่จะได้ 413)
- **ปิด** path `/ugt-lube-monitoring/api/cron/` และ `/ugt-lube-monitoring-dev/api/cron/` จากภายนอก (job เรียกจากใน container เท่านั้น)

> port ที่ทีมพัฒนาใช้ไว้ก่อนคือ prod `3000` / dev `3001` — ถ้าจัดสรร port อื่น แจ้งในตารางส่งกลับ

---

## ส่งกลับ

| ค่า | หาได้ที่ | ค่า |
| --- | --- | --- |
| SQL Server (prod + dev) — host:port | ตาราง A | |
| ชื่อ login ของเจ้าของโปรเจค (ใช้ทั้ง prod และ dev) | ตาราง A | |
| รหัสผ่านของ login นั้น | ตาราง A | ⚠️ **ส่งช่องทางปลอดภัย ห้ามกรอกที่นี่** |
| `APP_PORT` prod | port ที่จัดสรรบน server prod (ทีมพัฒนาใช้ `3000` ไว้ก่อน) | |
| `APP_PORT` dev | port ที่จัดสรรบน server dev (ทีมพัฒนาใช้ `3001` ไว้ก่อน) | |
| `KEYCLOAK_CLIENT_SECRET` prod | Keycloak → Clients → `ugt-lube-monitoring` → Credentials | ⚠️ **ส่งช่องทางปลอดภัย ห้ามกรอกที่นี่** |
| `KEYCLOAK_CLIENT_SECRET` dev | Keycloak → Clients → `ugt-lube-monitoring-dev` → Credentials | ⚠️ **ส่งช่องทางปลอดภัย ห้ามกรอกที่นี่** |
| `SMTP_HOST` / `SMTP_PORT` | SMTP relay ภายในองค์กร (relay ที่รับเมลจาก Docker host โดยไม่ต้อง login) | |
| `SMTP_FROM` | อีเมลผู้ส่งที่ relay อนุญาต (เช่น noreply@…) | |
| ลิงก์ Jenkins job | หน้า job `ugt-lube-monitoring` และ `ugt-lube-monitoring-dev` | |

## หลังระบบขึ้นแล้ว

- คนแรกที่ login จะถูกพาไปหน้า `/admin/setup` → กดปุ่มเดียวเป็น Administrator (ไม่มีบัญชี admin ตั้งไว้ล่วงหน้า) — **ให้คนที่ควรเป็น admin login คนแรก**
- job ตั้งเวลาดู log ได้ที่ `docker logs ugt-lube-monitoring-cron` (prod เท่านั้น — dev ไม่รัน job)


## ภาคผนวก — ครั้งแรกของ server (ข้ามถ้า server นี้มีโปรเจคมาตรฐานเดียวกันแล้ว)

| ที่ | ทำอะไร | ใส่ค่า (ชื่อต้องตรงเป๊ะ) |
| --- | --- | --- |
| Manage Jenkins → Plugins | ติดตั้ง plugin | NodeJS · SonarQube Scanner · OWASP Dependency-Check · JUnit · HTML Publisher · Email Extension · Pipeline · Git |
| Manage Jenkins → Tools | เพิ่ม tool | NodeJS `NodeJS-22` (22.x) · SonarQube Scanner `SonarQube-Scanner` · Dependency-Check `Dependency-Check` (Install automatically) |
| Manage Jenkins → System → SonarQube servers | เพิ่ม server | Name `SonarQube` + token |
| Manage Jenkins → System → Global properties | env var | `NOTIFY_EMAIL` · `SMTP_FROM` |
| SonarQube → Quality Gates → Create | เงื่อนไข (On New Code) | `new_violations` = 0 · `new_duplicated_lines_density` ≤ 3% · `new_coverage` ≥ 60% · `new_security_hotspots_reviewed` = 100% |
| Docker host | สร้าง network | `docker network create proxy-network` |
| Docker host (Jenkins) | ให้ Jenkins สั่ง docker ได้ | Jenkins มี Docker CLI · user `jenkins` อยู่ใน group `docker` ที่ GID ตรงกับ host (`getent group docker`) |
