# AGENTS.md

High-signal guidance for agent sessions in this repo. For detail, open the referenced files.
Claude Code sessions also load `CLAUDE.md` (org-standard block) and `.claude/rules/*`.

## Repo state

- **Lubrication monitoring only.** Modules: Dashboard, Watchlist, Drill-down (6 tabs + AI Diagnostic), Data Entry (+file attach/Excel-extract), Asset DB, Standards, Alarm Config, Reports (print/PDF), Admin (users, roles, notifications, email templates, audit trail).
- **2026-11-15 — moved to the org standard** (`/ugt-nextjs-full-setup`, preserve mode: same workflow and screens): Next.js 16 · React 19 · Tailwind v4 + shadcn base-mira kit · **Prisma 7 → SQL Server** · **Better Auth, Keycloak SSO only** · SMTP mail · attachments on a Docker volume · Jenkins + Docker + SonarQube. Supabase, Demo Mode, Local Store and Vercel are gone (decisions: `docs/adr/0001`–`0006`; system map: `docs/project-context/`).
- The PM Management Center (PM hub/calendar, work orders, budget, alert center, AI fleet chat) was removed 2026-10-28 — do not rebuild unless asked. Its old tables were not carried into SQL Server. The Oil Sampling Cycle page was removed too; `oil_sample_months` + Drill-down's next-sample month (`lib/sampling.ts`) stay. **Cu and Si** are no longer entered/read/scored; the columns stay.
- **Machine list** = `Final equipment in program.xlsx` (569 machines) → `prisma/seed-data/reference.json`, loaded by `npx prisma db seed` (inserts only new ids, never overwrites). Changes to existing machines go through the Asset DB import.
- **First admin**: the first SSO login lands on `/admin/setup` → one click → Administrator; it also creates the roles `engineer`/`manager`/`viewer` with their original permissions (`lib/permissions.ts` `DEFAULT_ROLES`). No signup page; accounts appear on first SSO login and wait for a role.
- **"View as"** (user card, `users:manage` only, cookie `view-as`, `lib/profile.ts`) changes only what is shown; actions use the user's own grants (`lib/actions/guards.ts`). Sidebar per role = `Role.MenuMain`, built by `lib/nav.ts` `sectionsFor` — view only.
- **AI** = `/api/ai/*` (GLM/OpenAI/Anthropic, server-only key) with rule-based fallback (works without `AI_API_KEY`).
- Open security items before going live: `Plan.md` PV-016.

## Source-of-truth (trust order — if they disagree, fix the doc)

| Need | Read |
| --- | --- |
| Scope, scoring formula, modules | `PRD.md` |
| System map, tables, deviations | `docs/project-context/architecture.md` (+ `api.md`, `business-rules.md`) |
| Decisions | `docs/adr/` |
| Design agreement | `docs/DESIGN.md` |
| Schema | `prisma/schema.prisma` + `prisma/migrations/` |
| Exact UI/UX + scoring logic of the original | `HTML/Lubrication_monitoring_final2 (1).html` (reference, not a target) |

## 🔴 Iron rule — do not violate

**Health Score = ONE formula, computed server-side only** (spec `PRD.md` §6).

- The formula is `lib/scoring/audit.ts` `getDeductionBreakdown`; `lib/scoring/recompute.ts` (`computeHealth`, `recomputeAllHealth`) runs it on the server and caches `Assets.Health` / `Assets.Status`. There is no SQL copy any more (ADR 0003).
- Never recompute on the client. Every page reads the cached columns and must show identical scores.
- Every write that can change a score calls `computeHealth(assetId)` after it commits (reading save/delete, VG grade, per-asset overrides); saving thresholds / score config calls `recomputeAllHealth()`.

## Security

- AI provider keys are server-only (`AI_API_KEY`); the prototype's browser-side LLM call is the bug, not the pattern.
- Every privileged Server Action: session → permission → (plant scope) → action → audit log. Plant scope replaces the old RLS: `requireAssetPermission` / `siteWhere` (`lib/queries/permissions.ts`).
- Never read `process.env` in app code — `import { env } from '@/lib/env'`.

## Conventions

- Plants: `CPL, TSL, UFA, UNT, UTCA` (seed). Asset type colors/abbreviations: `AssetTypes` table.
- Status: `<40 Critical`, `<80 Warning`, `≥80 Healthy`. UI is Thai-primary + English labels.
- Domain Prisma fields are snake_case to match `lib/types.ts` (ADR 0002); DB columns are PascalCase.
- Raw `fetch()` / `<a href>` / `window.open` must go through `withBase()` (`lib/base-path.ts`) — the app runs under a basePath.

## Lab Excel import — rules (PRD §7.4)

- Never auto-create assets. `lib/asset-match.ts` `matchTag`: exact or unique normalized TAG auto-selects; fuzzy matches are suggestions only; unknown/empty TAG blocks saving. Lab TAGs often differ from the asset id (`06-K01-B` vs `06-K01B`).
- Sampling date → period via `lib/parse/period.ts` (`parseSamplingPeriod`, `isPeriod`); never guess a month silently.
- ISO 4406 via `isoCodeIn` (`lib/parse/batch.ts`): only non-increasing codes ≤ 30 — otherwise d/m/yy dates (`9/7/26`) get stored as ISO.
- Batch import saves the whole file with `saveOilBatch` (`lib/actions/readings.ts`): one upsert per set of columns, so a file without a column never writes null over a saved value. Rows whose machine + month already have a reading wait for the user's "ยืนยันทับ". Unknown or out-of-scope TAGs fail only their row.
- Periods in the future are refused everywhere (`isFuturePeriod`).
- Numbers: a numeric cell's raw value wins over its formatted text (`cellNumber(text, raw)`); text "0,050" is a decimal comma. ISO codes may be `-/16/13`; a header with "VG" is never the ISO 4406 column.
- Blank cell ≠ 0: VG 0 means "no VG (e.g. SAE grade)" — viscosity is then checked against the generic `AlarmParams` visc limits (242/264 by default). Never turn 0 into a default (`cellNum` in `lib/asset-import.ts`).

## Dev commands

- `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm run format:check` · `npm test` / `npm run test:coverage`.
- First time: `.env.local` from `.env.example` → `npx prisma migrate deploy` → `npx prisma db seed`.
- Schema change: edit `prisma/schema.prisma` → `npx prisma migrate dev --name <change>` → `npx prisma generate`.
- After each module: verify Health Score parity across all pages; update `Plan.md` checkboxes.

## Git

Main branch `main`. Never commit `.env*`. CI/CD = Jenkins (`Jenkinsfile`): `develop` → dev, `main` → prod.
