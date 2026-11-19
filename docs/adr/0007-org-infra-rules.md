# 0007 — Org infrastructure rules: one owner login, no shadow DB, two Jenkins jobs, cron in compose

Date: 2026-11-16 · Status: accepted (project owner, org standard)

- **SQL login**: one login — the project owner's — on both the prod and dev servers, created by the admin team.
  Rights in each project DB: `db_datareader` · `db_datawriter` · `db_ddladmin` · `GRANT EXECUTE`; `dbcreator`
  on the dev server only.
- **No shadow database**: `SHADOW_DATABASE_URL` is gone. `prisma migrate dev` creates and drops its own
  temporary shadow DB through `dbcreator` on dev; `migrate deploy` (Jenkins) needs none.
- **Jenkins**: prod and dev are two separate Pipeline jobs (`*/main`, `*/develop`), never Multibranch. The
  `Jenkinsfile` reads the branch from `GIT_BRANCH` when `BRANCH_NAME` is unset.
- **Scheduled jobs** run in the `cron` service of `docker-compose.yml` (alpine + busybox crond, crontab inside the service `command:`), deployed
  with the app — never a host crontab. Prod only.
- **nginx**: the admin handoff states what the reverse proxy must cover, without config examples.

**Kit sync 2026-11-16 (ugt-nextjs-platform 4.89.0):** `components/ui/combobox.tsx` (event-details type read from
`onOpenChange`, any Base UI version), `prisma.config.ts` and `proxy.ts` (comments), `lib/email.ts` (nodemailer 10
typing) updated. The other 37 stamped files differ only by this project's own edits — the plugin did not change
them. Infra aligned with 4.89.0: the `cron` service moved from supercronic to the kit's alpine + busybox crond (no
Dockerfile change, no `jobs.crontab`), and the Jenkinsfile deploy pins the compose project with `-p`.
