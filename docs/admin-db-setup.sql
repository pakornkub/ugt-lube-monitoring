/* =============================================================================
   UGT Reliability Lube Monitoring (ugt-lube-monitoring) — สร้าง Database + Login  (admin-handoff.md ตาราง A)

   วิธีรัน (ครั้งเดียว บน SQL Server ที่มีทั้ง prod และ dev):
     SSMS  : เปิดไฟล์นี้ → เมนู Query → SQLCMD Mode (ต้องเปิด) → แทน CHANGE_ME ใน 2 บรรทัด :setvar ด้านล่าง → F5
     sqlcmd: :setvar ในไฟล์ชนะค่า -v เสมอ → ใช้ copy นอก repo ที่กรอก :setvar แล้ว
             sqlcmd -S <host> -E -i <copy>.sql  แล้วลบ copy ทิ้ง

   ผลลัพธ์:
     - database UGT_LubeMonitoring (prod) + UGT_LubeMonitoring_DEV (dev) · collation Thai_CI_AS
       · Is Read Committed Snapshot On = True · Recovery model = Full
       · Compatibility level = SQL Server 2019 (150) · Containment type = None
     - login SQL authentication 1 ตัว ใช้ทั้ง prod และ dev
     - login เป็น db_owner ของทั้ง 2 database
     - login อยู่ใน server role dbcreator (Prisma `migrate dev` สร้าง/ลบ shadow database ชั่วคราวเอง)
   รันซ้ำได้ — ของที่มีอยู่แล้วจะข้าม (ไม่เปลี่ยนรหัสผ่านของ login ที่มีอยู่)
   ไม่ต้องสร้างตาราง — pipeline รัน migration + seed ตอน deploy
   ============================================================================= */

SET NOEXEC OFF; -- ล้างค่าที่ค้างจากการรันผิดโหมดครั้งก่อนใน query window เดียวกัน
GO

:setvar LoginName "CHANGE_ME"
:setvar LoginPassword "CHANGE_ME"
-- รหัสผ่านห้ามมีเครื่องหมาย ' (single quote) · ห้าม commit ไฟล์นี้หลังกรอกรหัสจริง
:on error exit
GO

-- ด่านกันรันผิดโหมด: SQLCMD Mode ปิด → $(...) ไม่ถูกแทนค่าและ SSMS รัน batch ถัดไปต่อ
-- (ไม่มีด่านนี้จะได้ login ชื่อ "$(LoginName)" รหัส "$(LoginPassword)" จริง) → NOEXEC หยุดทุก batch ที่เหลือ
IF LEFT(N'$(LoginName)', 2) = N'$' + N'(' OR N'$(LoginName)' IN (N'', N'CHANGE_ME') OR N'$(LoginPassword)' IN (N'', N'CHANGE_ME')
BEGIN
    RAISERROR(N'หยุด: เปิด Query → SQLCMD Mode และกรอก :setvar LoginName / LoginPassword ก่อนรัน — ยังไม่มีอะไรถูกสร้าง', 16, 1);
    SET NOEXEC ON;
END
GO

USE master;
GO

IF DB_ID(N'UGT_LubeMonitoring') IS NULL
    CREATE DATABASE [UGT_LubeMonitoring] COLLATE Thai_CI_AS;
IF DB_ID(N'UGT_LubeMonitoring_DEV') IS NULL
    CREATE DATABASE [UGT_LubeMonitoring_DEV] COLLATE Thai_CI_AS;
GO

-- Read Committed Snapshot: อ่านไม่ถูก block โดยการเขียน (ROLLBACK IMMEDIATE ตัด connection ที่ค้างอยู่ใน DB นั้น)
IF (SELECT is_read_committed_snapshot_on FROM sys.databases WHERE name = N'UGT_LubeMonitoring') = 0
    ALTER DATABASE [UGT_LubeMonitoring] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
IF (SELECT is_read_committed_snapshot_on FROM sys.databases WHERE name = N'UGT_LubeMonitoring_DEV') = 0
    ALTER DATABASE [UGT_LubeMonitoring_DEV] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
GO

-- Recovery model Full (ต้องมี job backup log ไม่งั้น log โตไม่หยุด) · Compatibility level SQL Server 2019 (150)
-- Containment type = None เป็นค่า default ของ CREATE DATABASE อยู่แล้ว — ตรวจในผลท้าย script
ALTER DATABASE [UGT_LubeMonitoring] SET RECOVERY FULL;
ALTER DATABASE [UGT_LubeMonitoring] SET COMPATIBILITY_LEVEL = 150;
ALTER DATABASE [UGT_LubeMonitoring_DEV] SET RECOVERY FULL;
ALTER DATABASE [UGT_LubeMonitoring_DEV] SET COMPATIBILITY_LEVEL = 150;
GO

IF SUSER_ID(N'$(LoginName)') IS NULL
    CREATE LOGIN [$(LoginName)]
        WITH PASSWORD = N'$(LoginPassword)',
             DEFAULT_DATABASE = [UGT_LubeMonitoring_DEV],
             CHECK_POLICY = ON,
             CHECK_EXPIRATION = OFF; -- login ของแอป: รหัสหมดอายุ = ระบบล่ม
GO

IF IS_SRVROLEMEMBER(N'dbcreator', N'$(LoginName)') = 0
    ALTER SERVER ROLE [dbcreator] ADD MEMBER [$(LoginName)];
GO

USE [UGT_LubeMonitoring];
IF USER_ID(N'$(LoginName)') IS NULL
    CREATE USER [$(LoginName)] FOR LOGIN [$(LoginName)];
ALTER ROLE [db_owner] ADD MEMBER [$(LoginName)];
GO

USE [UGT_LubeMonitoring_DEV];
IF USER_ID(N'$(LoginName)') IS NULL
    CREATE USER [$(LoginName)] FOR LOGIN [$(LoginName)];
ALTER ROLE [db_owner] ADD MEMBER [$(LoginName)];
GO

-- ตรวจค่า database: RCSI = 1 · FULL · 150 · NONE
SELECT name AS [Database],
       is_read_committed_snapshot_on AS [RCSI],
       recovery_model_desc AS [Recovery],
       compatibility_level AS [Compat],
       containment_desc AS [Containment]
FROM sys.databases
WHERE name IN (N'UGT_LubeMonitoring', N'UGT_LubeMonitoring_DEV');

-- ตรวจสิทธิ์: ทุกคอลัมน์ต้องเป็น 1
SELECT N'$(LoginName)' AS [Login],
       IS_SRVROLEMEMBER(N'dbcreator', N'$(LoginName)') AS [dbcreator],
       (SELECT IS_ROLEMEMBER(N'db_owner', N'$(LoginName)')) AS [Dev_db_owner];
USE [UGT_LubeMonitoring];
SELECT IS_ROLEMEMBER(N'db_owner', N'$(LoginName)') AS [Prod_db_owner];
GO
