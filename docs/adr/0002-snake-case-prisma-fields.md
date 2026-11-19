# 0002 — Domain Prisma models keep snake_case field names

Date: 2026-11-15 · Status: accepted

The screens read row shapes defined in `lib/types.ts` (`asset_id`, `vg_grade`, …) — written for Supabase.
Naming the Prisma fields the same way kept every page and component unchanged (preserve mode). Database
column names still follow the org convention (PascalCase via `@map`). Auth/RBAC models stay camelCase as the
kit ships them. Lists (site access, tags, menus) are JSON arrays in NVarChar(Max), read and written only
through `lib/db/json.ts`.
