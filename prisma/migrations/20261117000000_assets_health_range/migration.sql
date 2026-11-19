-- A machine's Health Score stays within 0–100 (PRD.md · was Supabase 0028_health_range_check.sql).
-- lib/scoring/audit.ts already clamps; this stops a direct write (SQL, import) storing anything else.
-- Hand-written: Prisma schema cannot express CHECK constraints, and it ignores them when diffing.
ALTER TABLE [dbo].[Assets] ADD CONSTRAINT [Assets_Health_ck] CHECK ([Health] BETWEEN 0 AND 100);
