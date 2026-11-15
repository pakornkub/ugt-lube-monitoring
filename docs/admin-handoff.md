# คำขอตั้งค่าระบบ — UGT Reliability Lube Monitoring (`ugt-lube-monitoring`)

ผู้ขอ: pakornkub (ทีมพัฒนา) · 2026-11-15 · repo: `https://github.com/pakornkub/ugt-lube-monitoring.git`
**ทำเสร็จแล้ว กรอกตาราง "ส่งกลับ" ท้ายไฟล์ แล้วส่งไฟล์นี้คืนทีมพัฒนา** · ชื่อทุกตัวต้องพิมพ์ตามนี้เป๊ะ

## ขั้นตอนรวม

| # | ใครทำ | ระบบ | ทำอะไร | ดูตาราง |
| --- | --- | --- | --- | --- |
| 1 | DBA | SQL Server | สร้าง database 3 ตัว + login 2 ตัว | [A](#a-sql-server--database--login) |
| 2 | Admin | Server (Docker host) | เตรียม folder เก็บไฟล์ + ตั้ง backup | [B](#b-server--folder-เก็บไฟล์) |
| 3 | Admin | Jenkins | สร้าง credential | [C](#c-jenkins--credentials) |
| 4 | Admin | Jenkins | สร้าง pipeline job | [D](#d-jenkins--pipeline-job) |
| 5 | Admin | GitHub | ตั้ง webhook ไป Jenkins | [E](#e-github--webhook) |
| 6 | Admin | SonarQube | สร้าง 2 project + Quality Gate + webhook | [F](#f-sonarqube) |
| 7 | Admin | Keycloak | สร้าง client SSO | [G](#g-keycloak--client-sso) |
| 8 | Admin | Nginx | เพิ่ม reverse proxy | [H](#h-nginx--reverse-proxy) |
| 9 | Admin | Server prod (Docker host) | ตั้ง cron รัน job | [I](#i-server--cron) |
| 10 | ทุกคน | — | ส่งค่ากลับทีมพัฒนา | [ส่งกลับ](#ส่งกลับ) |

---


### A. SQL Server — Database + Login

ที่: **SSMS → server ตามคอลัมน์ "Server"** · login ใช้ SQL authentication

| สร้าง | Server | ชื่อ (พิมพ์ตามนี้) | สิทธิ์ที่ต้องให้ |
| --- | --- | --- | --- |
| Database prod | prod | `UGT_LubeMonitoring` | — |
| Database dev | dev | `UGT_LubeMonitoring_Dev` | — |
| Database shadow (ว่างไว้ ห้ามใส่ข้อมูล) | dev | `UGT_LubeMonitoring_Dev_shadow` | — |
| Login prod | prod | `ugt-lube-monitoring_app` | ใน `UGT_LubeMonitoring`: `db_datareader` · `db_datawriter` · `db_ddladmin` · `GRANT EXECUTE` |
| Login dev | dev | `ugt-lube-monitoring_dev` | ใน `UGT_LubeMonitoring_Dev`: เหมือน login prod · ใน `UGT_LubeMonitoring_Dev_shadow`: `db_owner` |

> ตารางสร้างเองตอน deploy (pipeline รัน migration) — DBA ไม่ต้องสร้างตาราง


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

### D. Jenkins — Pipeline job

ที่: **Dashboard → New Item**

| ช่อง | ใส่ค่า |
| --- | --- |
| Item name | `ugt-lube-monitoring` |
| Type | Multibranch Pipeline |
| Branch Sources → GitHub → Repository URL | `https://github.com/pakornkub/ugt-lube-monitoring.git` |
| Discover branches | `main`, `develop` |
| Lightweight checkout | **ปิด** (เปิดไว้ stage แรกพัง) |

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

ที่: **realm `<realm ขององค์กร>` → Clients → Create client** (1 client ต่อ 1 โปรเจค)

| ช่อง | ใส่ค่า |
| --- | --- |
| Client type | OpenID Connect |
| Client ID | `ugt-lube-monitoring` |
| Client authentication | On |
| Standard flow | On · ช่องอื่น (Direct access / Implicit / Service accounts) **Off** |
| Valid redirect URIs | `https://<app-host>/ugt-lube-monitoring-dev/api/auth/callback/keycloak` |
| 〃 (บรรทัดที่ 2) | `https://<app-host>/ugt-lube-monitoring/api/auth/callback/keycloak` |
| Web origins | `+` |
| Advanced → PKCE Method | S256 |


### H. Nginx — Reverse proxy

ที่: **ไฟล์ nginx ของ server** (เพิ่มแล้ว `nginx -s reload`)

| Server | เพิ่ม |
| --- | --- |
| dev | `location /ugt-lube-monitoring-dev { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; }` |
| prod + dev | `location ^~ /ugt-lube-monitoring/api/cron/ { deny all; }` (และของ dev) — job เรียกจากใน container เท่านั้น ห้ามเข้าจากนอก |
| prod + dev | `client_max_body_size 25m;` ใน location ของโปรเจค (ไม่ตั้ง = อัปโหลดไฟล์ใหญ่ได้ 413) |

> port `3001` เป็นค่าเสนอ — ถ้าจัดสรร port อื่น ใช้ port นั้นแทนแล้วแจ้งในตารางส่งกลับ


### I. Server — Cron

ที่: **Docker host prod → `sudo crontab -u jenkins -e`** (crontab ของ user `jenkins` — เจ้าของ `/home/docker02/appdata` และอยู่ใน group `docker`) (job ทุกตัวของระบบตั้งที่นี่ที่เดียว — dev ไม่ต้องตั้ง)

| Job | รอบเวลา | บรรทัดที่เพิ่มใน crontab |
| --- | --- | --- |
| (ครั้งแรก) สร้าง folder log | — | `sudo -u jenkins mkdir -p /home/docker02/appdata/ugt-lube-monitoring/logs` (รันมือ 1 ครั้ง) |
| `weekly-digest` | ทุกวันจันทร์ 13:00 (เวลาเดียวกับ Vercel cron เดิม 06:00 UTC) | `0 13 * * 1 docker exec ugt-lube-monitoring node -e "fetch('http://127.0.0.1:3000/ugt-lube-monitoring/api/cron/weekly-digest',{method:'POST',headers:{authorization:'Bearer '+process.env.CRON_SECRET},signal:AbortSignal.timeout(600000)}).then(async r=>{console.log(new Date().toISOString(),r.status,await r.text());process.exit(r.ok?0:1)},e=>{console.error(e);process.exit(1)})" >> /home/docker02/appdata/ugt-lube-monitoring/logs/cron.log 2>&1` |
| `attachments-sweep` | ทุกวัน 02:00 (ลบไฟล์แนบที่ถูกลบเกิน 90 วัน) | `0 2 * * * docker exec ugt-lube-monitoring node -e "fetch('http://127.0.0.1:3000/ugt-lube-monitoring/api/cron/attachments-sweep',{method:'POST',headers:{authorization:'Bearer '+process.env.CRON_SECRET},signal:AbortSignal.timeout(600000)}).then(async r=>{console.log(new Date().toISOString(),r.status,await r.text());process.exit(r.ok?0:1)},e=>{console.error(e);process.exit(1)})" >> /home/docker02/appdata/ugt-lube-monitoring/logs/cron.log 2>&1` |

> หลังเพิ่ม: รันส่วน `docker exec …` ด้วยมือ 1 ครั้งต่อ job ต้องได้ `{"ok":true…}` · `attachments-sweep` ลอง `…/attachments-sweep?dryRun=1` ก่อนรอบจริง

---

## ส่งกลับ

| ค่า | หาได้ที่ | ค่า |
| --- | --- | --- |
| SQL Server prod — host:port | ตาราง A | |
| SQL Server dev — host:port | ตาราง A | |
| รหัสผ่าน `ugt-lube-monitoring_app` / `ugt-lube-monitoring_dev` | ตาราง A | ⚠️ **ส่งช่องทางปลอดภัย ห้ามกรอกที่นี่** |
| `APP_PORT` prod | port ที่จัดสรรบน server prod (ทีมพัฒนาใช้ `3000` ไว้ก่อน) | |
| `APP_PORT` dev | port ที่จัดสรรบน server dev (ทีมพัฒนาใช้ `3001` ไว้ก่อน) | |
| `KEYCLOAK_ISSUER` | `https://<keycloak-host>/realms/<realm ขององค์กร>` | |
| `KEYCLOAK_CLIENT_SECRET` | Keycloak → Clients → `ugt-lube-monitoring` → Credentials | ⚠️ **ส่งช่องทางปลอดภัย ห้ามกรอกที่นี่** |
| `SMTP_HOST` / `SMTP_PORT` | SMTP relay ภายในองค์กร (relay ที่รับเมลจาก Docker host โดยไม่ต้อง login) | |
| `SMTP_FROM` | อีเมลผู้ส่งที่ relay อนุญาต (เช่น noreply@…) | |
| ลิงก์ Jenkins job | หน้า job `ugt-lube-monitoring` | |

## หลังระบบขึ้นแล้ว

- คนแรกที่ login จะถูกพาไปหน้า `/admin/setup` → กดปุ่มเดียวเป็น Administrator (ไม่มีบัญชี admin ตั้งไว้ล่วงหน้า) — **ให้คนที่ควรเป็น admin login คนแรก**


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
