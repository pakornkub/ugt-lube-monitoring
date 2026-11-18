/* =============================================================================
   UGT Reliability Lube Monitoring (ugt-lube-monitoring) — สร้าง Database + Login  (admin-handoff.md ตาราง A)

   รันที่: SQL Server prod · ครั้งเดียว · รันซ้ำได้ (ของที่มีอยู่แล้วจะข้าม ไม่เปลี่ยนรหัสผ่าน login เดิม)

   วิธีรัน (SSMS):
     1. เปิดไฟล์นี้ → เมนู Query → SQLCMD Mode (ต้องเปิด ไม่งั้น :setvar error)
     2. แทน CHANGE_ME ใน 2 บรรทัด :setvar ด้านล่าง → F5
     3. ผลตรวจสิทธิ์ต้องเป็น 1 ทุกคอลัมน์ · ผลตรวจค่า database ท้ายไฟล์ตรงตามที่เขียนไว้
     4. ปิดไฟล์โดยไม่ save — รหัสผ่านห้ามอยู่ในไฟล์ / ห้าม commit
   sqlcmd: :setvar ในไฟล์ชนะค่า -v เสมอ → ใช้ copy นอก repo ที่กรอก :setvar แล้ว
           sqlcmd -S <host> -E -i <copy>.sql  แล้วลบ copy ทิ้ง

   ไม่ต้องสร้างตาราง — pipeline รัน migration ตอน deploy
   ============================================================================= */

SET NOEXEC OFF; -- ล้างค่าที่ค้างจากการรันผิดโหมดครั้งก่อนใน query window เดียวกัน
GO

:setvar LoginName "CHANGE_ME"
:setvar LoginPassword "CHANGE_ME"
-- รหัสผ่านห้ามมีเครื่องหมาย ' (single quote)
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

-- ค่ามาตรฐานของ database (ทุกบรรทัดรันซ้ำได้):
--   Read Committed Snapshot ON — อ่านไม่ถูก block โดยการเขียน (ROLLBACK IMMEDIATE ตัด connection ที่ค้างใน DB นั้น — ทำเฉพาะตอนยังไม่เปิด)
--   Recovery FULL — ต้องมี job backup transaction log ไม่งั้นไฟล์ log โตไม่หยุด
--   Compatibility level 150 · Containment NONE (ค่า default ของ CREATE DATABASE — ตรวจในผลท้าย script)

IF DB_ID(N'UGT_LubeMonitoring') IS NULL
    CREATE DATABASE [UGT_LubeMonitoring] COLLATE Thai_CI_AS;
IF (SELECT is_read_committed_snapshot_on FROM sys.databases WHERE name = N'UGT_LubeMonitoring') = 0
    ALTER DATABASE [UGT_LubeMonitoring] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
ALTER DATABASE [UGT_LubeMonitoring] SET RECOVERY FULL;
ALTER DATABASE [UGT_LubeMonitoring] SET COMPATIBILITY_LEVEL = 150;
GO

IF SUSER_ID(N'$(LoginName)') IS NULL
    CREATE LOGIN [$(LoginName)]
        WITH PASSWORD = N'$(LoginPassword)',
             CHECK_POLICY = ON,
             CHECK_EXPIRATION = OFF; -- login ของแอป: รหัสหมดอายุ = ระบบล่ม
GO

USE [UGT_LubeMonitoring];
IF USER_ID(N'$(LoginName)') IS NULL
    CREATE USER [$(LoginName)] FOR LOGIN [$(LoginName)];
ALTER ROLE [db_datareader] ADD MEMBER [$(LoginName)];
ALTER ROLE [db_datawriter] ADD MEMBER [$(LoginName)];
ALTER ROLE [db_ddladmin] ADD MEMBER [$(LoginName)];
GRANT EXECUTE TO [$(LoginName)];
SELECT DB_NAME() AS [Database]
     , IS_ROLEMEMBER(N'db_datareader', N'$(LoginName)') AS [db_datareader]
     , IS_ROLEMEMBER(N'db_datawriter', N'$(LoginName)') AS [db_datawriter]
     , IS_ROLEMEMBER(N'db_ddladmin', N'$(LoginName)') AS [db_ddladmin]
     , (SELECT COUNT(*) FROM sys.database_permissions WHERE grantee_principal_id = USER_ID(N'$(LoginName)') AND class = 0 AND permission_name = N'EXECUTE' AND state = N'G') AS [EXECUTE]
;
GO

-- ตรวจค่า database: RCSI = 1 · Recovery = FULL · Compat = 150 · Containment = NONE
-- (แยก server: database ของอีก server ไม่อยู่ในผล — ปกติ)
SELECT name AS [Database],
       is_read_committed_snapshot_on AS [RCSI],
       recovery_model_desc AS [Recovery],
       compatibility_level AS [Compat],
       containment_desc AS [Containment]
FROM sys.databases
WHERE name IN (N'UGT_LubeMonitoring', N'UGT_LubeMonitoring_DEV');
GO
