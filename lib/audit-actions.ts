// kit: ugt-nextjs-platform 4.79.0 · ugt-nextjs-auth-setup/lib/audit-actions.ts
// kit-hash: 051abfbd5ed7
/**
 * Audit action keys — single source of truth for every string written to
 * `ActivityLogs.action`.
 *
 * Naming: `<resource>.<verb>`, **all lowercase**, dot-separated, kebab inside a
 * segment (`users.role-assign`, `users.password-set`). No camelCase — the
 * viewer's action filter groups by the exact string, so `users.resetPassword`
 * and `users.password-set` would show up as two unrelated events for one thing.
 *
 * Rule (references/audit-logging.md): **never write a raw string at a call
 * site** — a typo becomes a row nobody can filter for, and renaming an event
 * later means a data migration instead of an edit here.
 *
 * The block below is the org-mandated set (contract §2 item 4). Everything in
 * it is written by the shipped assets; add the project's own domain actions at
 * the EXTENSION POINT.
 */
export const AUDIT_ACTIONS = {
  // Authentication — written by lib/actions/auth.ts and lib/auth.ts
  LOGIN_SUCCESS: 'login.success',
  LOGIN_FAILED: 'login.failed',
  LOGOUT: 'logout',
  LOGOUT_SSO: 'logout.sso',

  // First-admin bootstrap — lib/actions/admin-setup.ts
  ADMIN_BOOTSTRAP: 'admin.bootstrap',

  // Attachments — app/api/files/** and lib/actions/attachments.ts
  FILE_UPLOAD: 'file.upload',
  FILE_DOWNLOAD: 'file.download',
  FILE_DELETE: 'file.delete',

  // Domain data changes keep the action names the Supabase-era audit trail used
  // (INSERT / UPDATE / DELETE … + TableName/RecordId columns) — lib/actions/audit-log.ts.
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
