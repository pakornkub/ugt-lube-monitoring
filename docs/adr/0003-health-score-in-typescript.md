# 0003 — Health Score computed in TypeScript on the server

Date: 2026-11-15 · Status: accepted

The old system kept the formula twice: SQL `compute_health` (triggers) and a TypeScript parity port
(`lib/scoring/audit.ts`), with a test keeping them equal. On SQL Server the formula exists once: the
TypeScript one, run server-side by `lib/scoring/recompute.ts` after every write that can change a score, and
cached in `Assets.Health/Status`. The iron rule is unchanged: never compute on the client, every page reads
the cached value. Any formula change now lands in one file (+ its tests and PRD §6).
