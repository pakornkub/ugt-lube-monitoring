<!-- ugt:start 4.88.1 — this block is owned by `ugt-nextjs-full-setup` and may be rewritten wholesale on /plugin update.
     Put project-specific content OUTSIDE the markers or it will be lost on update.
     The version above is the ugt-nextjs-platform release that wrote this block —
     full-setup's verify.mjs warns when it falls behind the installed plugin.
     (HTML comments are stripped before entering context, so they cost no tokens.) -->

## Stack

Next.js (App Router) · TypeScript · React · Prisma → SQL Server ·
Better Auth (SSO Keycloak) · Vitest · Jenkins + SonarQube + Docker

Project `ugt-lube-monitoring` · basePath prod `/ugt-lube-monitoring` · dev `/ugt-lube-monitoring-dev`

## Commands

```bash
npm run dev            # develop
npm run build          # must pass before every push
npm run lint           # eslint
npm run format:check   # prettier (the pipeline calls this exact name)
npm run test:coverage  # vitest + coverage (Quality Gate needs >= 60% on new code)
```

## Rules that break the build every time

- `DATABASE_URL` lives in `prisma.config.ts` **only** — never put `url` in the
  `datasource` block of `schema.prisma`
- Never read `process.env` directly in app code — always `import { env } from '@/lib/env'`
  (exceptions: `lib/env.ts`, root `*.config.ts`, `instrumentation*.ts`, `sentry.*.config.ts`, test files)
- After every `schema.prisma` change: `npx prisma migrate dev` → **then always** `npx prisma generate`
- New tables: `@@map("PascalCasePlural")` + every field `@map("PascalCase")` + full audit columns
  (`Id/CreatedAt/UpdatedAt/CreatedBy/UpdatedBy/IsActive/IsDeleted`) · delete via `IsDeleted = 1`, never hard delete
- Never use a T-SQL reserved word as a column name (`key`, `value`, `group`, `count`, `order`) — add a qualifier
- Every privileged Server Action: **session → permission → action → audit log**, in that order
- Never `$queryRawUnsafe` / `$executeRawUnsafe` with user input — use tagged templates
- New TS/TSX code must pass the SonarQube Quality Gate on the first scan (`new_violations = 0`)
  — `ugt-nextjs-clean-code` loads itself when you touch `.ts`/`.tsx` files; follow it

## Team state + project knowledge (committed to the repo)

@.claude/state/handoff.md

@docs/project-context/00-index.md

- **Treat committed files as the latest truth** — on conflict with auto memory,
  they win (auto memory is machine-local, not shared with the team)
- **Call `/ugt-handoff` at the end of every work chunk** — it updates the
  handoff file + feature board + affected `docs/project-context/` files; commit
  the whole set together
- ก่อนเสนอเปลี่ยนแนวทาง/lib/โครงสร้าง → เช็คบ้านมติของโปรเจค (`00-index.md`
  บอกว่าเป็น `decisions.md` หรือ `docs/adr/`) ก่อนว่าเคยเคาะไปแล้วหรือยัง —
  ถ้าขัดมติเดิม ให้ยกขึ้นมาคุย ไม่ทำเงียบ ๆ
- เจอ error แปลก → เปิด `docs/project-context/troubleshooting.md` ก่อนเริ่ม debug
- Keep `handoff.md` short (~60 lines) — it loads into context every session

## Model mode (subagent routing)

@.claude/state/model-mode.md

- Follow that table when dispatching subagents or spawning teammates · **print
  the dispatch plan first** (Work · Task type · Model · Why — one table per
  batch, then proceed) so the user sees who gets which model · switch
  preset with `/ugt-model-mode easy|default|god|auto` (new projects start on
  `auto`) · main session model stays the user's `/model` · this table **wins
  over model advice inside any pipeline skill** (e.g. superpowers SDD's Model
  Selection section)
- Every subagent prompt carries what the task needs — the answers already
  collected, the files, the definition of done — and says the user is not
  watching: the subagent proceeds without asking and stops only for a
  destructive action or a question the prompt does not cover

## Which skill, when

| Task | How |
| --- | --- |
| Start from a requirements folder | `/ugt-requirements` in **thin mode** (sources inventory + feature list + board rows — no per-feature brief, no Open Questions) → `/wayfinder` (whole project) or `/grill-with-docs` (one feature) closes the gaps → `/to-spec` |
| First-time knowledge base (`docs/project-context/`) on an existing codebase | `ugt-context` — bootstrap once; afterwards `/ugt-handoff` maintains it |
| Install/change infrastructure (DB, auth, test/lint, CI, deploy) | Invoke the matching `ugt-*` skill **directly** — it has its own interview; the setup path never auto-invokes skills from the pipeline/helper plugins (superpowers / mattpocock-skills / frontend-design), however well their triggers match: the skill's SKILL.md is the plan, its verify script is the review |
| Build a feature / fix a bug | Don't auto-invoke any mattpocock skill — they are user-invoked. Read the relevant `docs/project-context/` files, then do the work directly with tests alongside; when the requirement is ambiguous, suggest `/grill-with-docs`. Full sequence and detours (prototype/triage/wayfinder) are at `/ask-matt` |
| Write/edit `.ts`/`.tsx` files | `ugt-nextjs-clean-code` + `ugt-nextjs-pitfalls` load themselves via `paths` — no need to invoke |
| Finish work / hand off the session | `/ugt-handoff` |

### Merging a feature branch (mattpocock)

Nothing reviews code automatically on this bundle — before merging any
feature branch, confirm `/code-review` (mattpocock's two-axis review) was
run on it; if not, run it first, then do the integration check (full
test/lint suite) and update the board via `/ugt-handoff`.

## Where new knowledge goes

- Work state (ค้างไหน คิวอะไร คำถามค้าง) → `.claude/state/handoff.md`
- True only for this project → the matching `docs/project-context/` file
  (error ที่เคยเจอ → `troubleshooting.md` · กติกา as-built
  → `business-rules.md` · โครงสร้าง → `architecture.md`) or
  `.claude/rules/<project>-*.md` if path-bound · มติ design → `docs/DESIGN.md` §10
- มติ (ไม่ใช่ design) → `docs/adr/` (`domain-modeling` หรือ `/ugt-handoff` เพิ่มไฟล์ใหม่) — โปรเจคนี้
  **ไม่มี `decisions.md`** จะได้ไม่มีบ้านมติสองที่
- True for every project on this stack → **open a PR against the
  `ugt-claude-platform` repo** — never edit installed skill files (plugin cache,
  deleted on update)
- Personal preference → auto memory · never create `.claude/skills/ugt-<same-name>/`
  shadowing a platform skill — extend under a new name
- **โปรเจคที่ใช้ mattpocock bundle**: `grill-with-docs`/`domain-modeling`
  สร้าง/ดูแล `CONTEXT.md` (root, glossary) และ `docs/adr/`
  (การตัดสินใจทางเทคนิค) เอง — คนละที่เก็บกับ `docs/project-context/`
  โดยตั้งใจ **ห้าม copy เนื้อหาข้ามกัน**: เริ่มงานอ่านทั้งคู่
  (`docs/project-context/00-index.md` + `CONTEXT.md`/`docs/adr/` ถ้ามี)
  แต่เขียนแค่ที่เจ้าของมันเขียน — `/ugt-handoff` ดูแลเฉพาะ
  `docs/project-context/` + `handoff.md` ไม่แตะ `CONTEXT.md` ไม่แก้ ADR เดิม — มติใหม่ที่ยังไม่มี ADR
  เพิ่มเป็นไฟล์ใหม่ `docs/adr/NNNN-<slug>.md` ตามรูปแบบเดิมได้ (ugt-handoff ตาราง decisions)
- `.scratch/<feature>/` (spec + tickets + `Status:` ต่อ ticket) เป็นของ
  `/to-spec`/`/to-tickets`/`/implement` — ระดับ **ticket** · `board.md` +
  `handoff.md` เป็นระดับ **feature** — ห้าม copy เนื้อหาข้ามกัน

<!-- ugt:end -->
