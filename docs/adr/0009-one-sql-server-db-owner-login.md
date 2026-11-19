# 0009 — prod and dev on one SQL Server; the owner login is `db_owner`

Date: 2026-11-18 · Status: accepted (project owner) · Changes the SQL login part of [0007](0007-org-infra-rules.md)

- **One SQL Server holds both databases** (`UGT_LubeMonitoring`, `UGT_LubeMonitoring_DEV`), and the DBA runs one
  script, `docs/admin-db-setup.sql`, the same way as `ugt-rd-laboratory`. **Because** the owner wants this project's DBA
  request to match the reference project, not the plugin template's split output.
- **The owner login is `db_owner` in both databases** and is in `dbcreator`, with default database
  `UGT_LubeMonitoring_DEV`. It is still one login for prod and dev, and the admin team creates it. **Because** the
  reference project grants it this way. Rejected: `db_datareader` · `db_datawriter` · `db_ddladmin` · `GRANT EXECUTE`
  on separate prod and dev servers (0007, plugin 4.92.0 `[RWX]`/`[SPLIT]`).
- The script is written by hand to match the `ugt-rd-laboratory` file, not rendered from the plugin template. The
  template cannot set `DEFAULT_DATABASE`, and it orders the batches differently. cicd `verify.mjs` still checks it:
  no placeholders, and `LoginPassword` stays `CHANGE_ME`.
- Dev database name `UGT_LubeMonitoring_DEV`, not `_Dev` (org standard 2026-11-18, plugin 4.92.0).
