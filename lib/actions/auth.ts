// kit: ugt-nextjs-platform 4.79.0 · ugt-nextjs-auth-setup/lib/actions/auth.ts
// kit-hash: a31813d47215
'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { AUDIT_ACTIONS, type AuditAction } from '@/lib/audit-actions';
import { env } from '@/lib/env';

// ─── Cookie naming ───────────────────────────────────────────────────────────
// Derive cookie prefix from NEXT_PUBLIC_BASE_PATH — MUST stay in sync with
// lib/auth.ts (advanced.cookiePrefix) and proxy.ts (getSessionCookie call).
// This makes the session cookie name unique per app on the same domain, preventing
// cross-app cookie collisions that cause ERR_TOO_MANY_REDIRECTS redirect loops.
const APP_COOKIE_PREFIX = (env.NEXT_PUBLIC_BASE_PATH || '').replace(/^\//, '') || 'better-auth';
// Better Auth uses the __Secure- prefix when BETTER_AUTH_URL starts with https://.
// This MUST match what Better Auth computes internally — otherwise auth.api.getSession()
// cannot find the cookie (even though proxy's getSessionCookie() tries both names).
// Source: node_modules/better-auth/dist/cookies → createCookieGetter()
const SESSION_COOKIE_NAME = (env.BETTER_AUTH_URL ?? '').startsWith('https://')
  ? `__Secure-${APP_COOKIE_PREFIX}.session_token`
  : `${APP_COOKIE_PREFIX}.session_token`;

// Single source of truth for the cookie Secure attribute — MUST match the cookie
// NAME above: a __Secure- prefixed cookie set without the Secure attribute is
// silently rejected by the browser. Never derive `secure` from NODE_ENV.
const SECURE_COOKIE = SESSION_COOKIE_NAME.startsWith('__Secure-');

// ─── Request metadata + audit logging ────────────────────────────────────────

async function getRequestMeta(): Promise<{ ip: string; userAgent: string }> {
  const headersList = await headers();
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0].trim() ??
    headersList.get('x-real-ip') ??
    'unknown';
  const userAgent = headersList.get('user-agent') ?? 'unknown';
  return { ip, userAgent };
}

// Non-blocking — never throw; audit failure must not interrupt auth flow.
// `action` is typed AuditAction, not string — the constant is the only way in
// (references/audit-logging.md: never a raw string at a call site).
async function logAuthEvent(
  action: AuditAction,
  userId: string,
  detail: Record<string, unknown>
): Promise<void> {
  await prisma.activityLog
    .create({ data: { userId, action, detail: JSON.stringify(detail) } })
    .catch(() => {});
}

// ─── Cookie clearing (shared by both logout actions) ─────────────────────────
// IMPORTANT: must use cookieStore.set() with maxAge:0 instead of cookieStore.delete().
// cookies().delete() does NOT include the Secure flag on the Set-Cookie response header.
// For __Secure- prefixed cookies the browser REQUIRES Secure to be present —
// without it the browser silently ignores the deletion and the cookie persists.

async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  const isSecure = SECURE_COOKIE;
  const clearAttrs = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isSecure,
    maxAge: 0,
    path: '/',
  };

  cookieStore.set(SESSION_COOKIE_NAME, '', clearAttrs);

  // Also clear the session_data cache cookie that Better Auth may have set alongside
  // the session_token (used for the client-side session cache).
  const sessionDataCookie = isSecure
    ? `__Secure-${APP_COOKIE_PREFIX}.session_data`
    : `${APP_COOKIE_PREFIX}.session_data`;
  cookieStore.set(sessionDataCookie, '', clearAttrs);
}

// Delete the DB session for the current cookie and return its userId (or null).
async function deleteDbSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const signedToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!signedToken) return null;

  // Cookie value is URL-decoded signed format: `rawToken.base64sig`
  // Strip the HMAC signature to get the raw token stored in DB.
  const rawToken = signedToken.substring(0, signedToken.lastIndexOf('.'));
  if (!rawToken) return null;

  // Fetch userId before deleting (needed for audit log)
  const sessionRecord = await prisma.session
    .findFirst({ where: { token: rawToken }, select: { userId: true } })
    .catch(() => null);
  await prisma.session.deleteMany({ where: { token: rawToken } }).catch(() => {});
  return sessionRecord?.userId ?? null;
}

// ─── Logout ──────────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const userId = await deleteDbSession();
  if (userId) {
    const { ip, userAgent } = await getRequestMeta();
    await logAuthEvent(AUDIT_ACTIONS.LOGOUT, userId, { ip, userAgent });
  }

  await clearSessionCookies();
  redirect('/login');
}

// ─── SSO Logout (Keycloak) ───────────────────────────────────────────────────
// [METHOD: SSO] — delete this action if SSO is not enabled.
// Clears the local session then invalidates the Keycloak SSO session via
// backchannel logout (server-side POST) — the browser never gets redirected
// through Keycloak, it goes directly to /login.

export async function ssoLogoutAction(): Promise<void> {
  const userId = await deleteDbSession();
  if (userId) {
    const { ip, userAgent } = await getRequestMeta();
    await logAuthEvent(AUDIT_ACTIONS.LOGOUT_SSO, userId, { ip, userAgent });
  }

  // Backchannel logout: POST directly to Keycloak — no browser redirect.
  // Uses the stored refresh_token to identify the session to revoke.
  // Non-fatal: if Keycloak is unreachable or token is already expired,
  // we still clear the local session and redirect to /login.
  if (userId && env.KEYCLOAK_ISSUER && env.KEYCLOAK_CLIENT_ID && env.KEYCLOAK_CLIENT_SECRET) {
    const keycloakAccount = await prisma.account
      .findFirst({
        where: { userId, providerId: 'keycloak' },
        select: { refreshToken: true },
      })
      .catch(() => null);

    if (keycloakAccount?.refreshToken) {
      const logoutUrl = `${env.KEYCLOAK_ISSUER}/protocol/openid-connect/logout`;
      const body = new URLSearchParams({
        client_id: env.KEYCLOAK_CLIENT_ID,
        client_secret: env.KEYCLOAK_CLIENT_SECRET,
        refresh_token: keycloakAccount.refreshToken,
      });
      await fetch(logoutUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      }).catch(() => {});
    }
  }

  await clearSessionCookies();
  redirect('/login');
}
