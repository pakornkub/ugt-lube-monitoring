# 0007 — Org infrastructure rules: one owner login, no shadow DB, two Jenkins jobs, cron in compose

Date: 2026-11-16 · Status: accepted (project owner, org standard)

- **SQL login**: one login — the project owner's — on both the prod and dev servers, created by the admin team.
  Rights in each project DB: `db_datareader` · `db_datawriter` · `db_ddladmin` · `GRANT EXECUTE`; `dbcreator`
  on the dev server only.
- **No shadow database**: `SHADOW_DATABASE_URL` is gone. `prisma migrate dev` creates and drops its own
  temporary shadow DB through `dbcreator` on dev; `migrate deploy` (Jenkins) needs none.
- **Jenkins**: prod and dev are two separate Pipeline jobs (`*/main`, `*/develop`), never Multibranch. The
  `Jenkinsfile` reads the branch from `GIT_BRANCH` when `BRANCH_NAME` is unset.
- **Scheduled jobs** run in the `cron` service of `docker-compose.yml` (supercronic + `jobs.crontab`), deployed
  with the app — never a host crontab. Prod only.
- **nginx**: the admin handoff states what the reverse proxy must cover, without config examples.
