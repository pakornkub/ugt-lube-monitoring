# 0001 — SQL Server + Prisma replaces Supabase; Demo Mode and Local Store removed

Date: 2026-11-15 · Status: accepted

The org deploys on Jenkins + Docker with SQL Server, Keycloak and the ugt-nextjs kit. The app ran on
Supabase cloud (Postgres, Auth, Storage, RLS) with a Demo Mode (in-memory data) and a Local Store (JSON
files). The owner chose the full org standard. There was no real data to move, so the database starts from
`prisma/migrations/0_init` + `prisma/seed.ts` (569 machines from `Final equipment in program.xlsx`, plants,
types, thresholds, 16 standards — dumped from the old migrations). Demo Mode and Local Store are gone; every
screen reads SQL Server. RLS is replaced by checks in code: `requirePermission` / `requireAssetPermission`
(`lib/actions/guards.ts`) and the plant scope (`lib/queries/permissions.ts`). The `supabase/` folder was
deleted (it stays in git history).
