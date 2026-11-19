# 0008 — Users without a role keep the dashboard; oil-change due follows "Last update"

Date: 2026-11-18 · Status: accepted (project owner)

- **No-role users (D1)**: someone who signs in through SSO before an admin assigns a role still sees the
  dashboard for every plant, read-only — the behaviour the app had on Supabase. Admins are mailed about the user
  (`lib/after-login.ts`). **Because** the owner wants anyone with a company account to see the fleet overview.
  Rejected: a "waiting for a role" notice with no data pages (the kit checklist's default).
- **Oil-change due date (code-review Spec 5)**: stays `last_update + oil_change_months`
  (`components/drilldown/DrillDownClient.tsx`), and `last_update` keeps moving with the newest reading
  (`lib/scoring/recompute.ts`, change of 2026-11-15). A machine sampled every month therefore never shows the oil
  change as due. **Because** the owner prefers "Last update" to follow the lab data. Rejected: splitting the
  displayed "Last update" from the oil-change base, and returning to `main`'s behaviour (readings never move
  `last_update`).
- **Viewer and Data Entry (D2)**: closed by the owner's role matrix — Viewer sees every menu, Data Entry included,
  read-only. `DEFAULT_ROLES` in `lib/permissions.ts` matches the matrix.

**Kit sync 2026-11-18 (ugt-nextjs-platform 4.89.0 → 4.91.1):** `lib/org-email.ts` + `lib/org-email.test.ts` taken
from the kit (examples now put `ube.co.th` first, 4.90.0). `lib/audit-actions.ts` and `lib/actions/admin-setup.ts`
keep this project's version (four app roles, `admin.bootstrap` audit added on 2026-11-17 — the same fix as
plugin PR pakornkub/ugt-claude-platform#70, released in 4.91.0) with the 4.91.0 stamp lines. `.env.example` and the
compose comments now say `ORG_EMAIL_DOMAINS=ube.co.th,ube.com`. The other 35 stamped files differ only by this
project's own edits; the plugin did not change them after 4.89.0.
