# UGT Reliability Lube Monitoring

Condition-monitoring and reliability platform for industrial lubrication and vibration analysis — machine
health scoring, oil/vibration readings, lab Excel import, AI-assisted diagnostics, standards library and
executive reporting.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 + shadcn (base-mira) · Prisma 7 → SQL Server ·
Better Auth (Keycloak SSO) · Jenkins + Docker + SonarQube.

> Product spec, modules and scoring formula: [`PRD.md`](PRD.md) · agent working rules: [`AGENTS.md`](AGENTS.md) ·
> design agreement: [`docs/DESIGN.md`](docs/DESIGN.md) · system map: [`docs/project-context/`](docs/project-context/00-index.md) ·
> server setup request: [`docs/admin-handoff.md`](docs/admin-handoff.md)

## Prerequisites

- Node.js 22
- A SQL Server database (dev) and a Keycloak client — see `docs/admin-handoff.md`

## Local setup

```bash
npm install
cp .env.example .env.local      # fill DATABASE_URL, BETTER_AUTH_*, KEYCLOAK_*, (SMTP_*, CRON_SECRET)
npx prisma migrate deploy        # creates the tables (prisma/migrations)
npx prisma db seed               # 569 machines + plants, types, thresholds, standards
npm run dev
```

Log in with SSO. The **first** person to log in is sent to `/admin/setup` and becomes Administrator with one
click (it also creates the Engineer / Manager / Viewer roles). Everyone else gets a role from Admin → Users.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop / production build / run the build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` · `npm run format:check` | ESLint · Prettier (the pipeline calls these names) |
| `npm test` · `npm run test:coverage` | Vitest (JUnit + lcov when `CI=true`) |

Pre-commit (husky + lint-staged) formats and lints staged files.

## Deploying

Push `develop` (dev, `/ugt-lube-monitoring-dev`) or `main` (prod, `/ugt-lube-monitoring`) — Jenkins runs
lint/format/typecheck → tests → build → OWASP → SonarQube Quality Gate → Docker build → migrate → deploy
(`Jenkinsfile`, `Dockerfile`, `docker-compose*.yml`). Attachments live on the bind mount
`/home/docker02/appdata/<project>/storage`. Scheduled jobs (weekly digest, attachment sweep) run in the `cron` service of `docker-compose.yml` (alpine + busybox crond).

## Health Score — read before touching scoring code

One formula, computed server-side only: `lib/scoring/audit.ts`, written to `Assets.Health/Status` by
`lib/scoring/recompute.ts` after every write that can change a score. Every page reads that cached value —
never recompute it client-side. See `AGENTS.md` and `PRD.md` §6.
