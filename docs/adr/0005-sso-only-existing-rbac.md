# 0005 — Keycloak SSO only; the app keeps its own roles, menus and admin pages

Date: 2026-11-15 · Status: accepted

Login is Keycloak SSO via Better Auth (no local passwords, no LDAP, no HR directory). Accounts appear at first
login; the first user claims Administrator at `/admin/setup`, which also creates the app's four roles
(`admin`, `engineer`, `manager`, `viewer`) with their old permission sets (`lib/permissions.ts`). The app's
own admin pages (users with plant access, role matrix, sidebar per role, "view as", audit trail) stay instead
of the kit's pages; they read the kit's `User`/`Role`/`Permission` tables. The audit trail moved from
`audit_log` into the kit's `ActivityLogs` (extra columns TableName/RecordId/OldValue/NewValue).
