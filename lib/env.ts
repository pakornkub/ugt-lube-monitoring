// lib/env.ts — type-safe env validation via @t3-oss/env-nextjs + zod.
// App code MUST import env from here — never read process.env directly.
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    // ── 1. App + runtime
    APP_PORT: z.string().optional(),
    // Host cron → /api/cron/<job> sends it as a Bearer token.
    CRON_SECRET: z.string().optional(),

    // ── 2. Database
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    // ── 3. Auth
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
    ORG_EMAIL_DOMAINS: z.string().optional(),
    KEYCLOAK_ISSUER: z.url(),
    KEYCLOAK_CLIENT_ID: z.string().min(1),
    KEYCLOAK_CLIENT_SECRET: z.string().min(1),

    // ── 4. Mail
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().default('25'),
    SMTP_SECURE: z.enum(['true', 'false']).default('false'),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),

    // ── 5. Upload
    STORAGE_ROOT: z.string().default('./storage'),
    UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(26_214_400),

    // ── 6. Project-specific — AI diagnosis (server-only key; rule-based fallback without it)
    AI_PROVIDER: z.string().optional(),
    AI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().optional(),
    AI_BASE_URL: z.string().optional(),

    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  },

  client: {
    NEXT_PUBLIC_BASE_PATH: z.string().default(''),
    NEXT_PUBLIC_APP_NAME: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().optional(),
  },

  runtimeEnv: {
    APP_PORT: process.env.APP_PORT,
    CRON_SECRET: process.env.CRON_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    ORG_EMAIL_DOMAINS: process.env.ORG_EMAIL_DOMAINS,
    KEYCLOAK_ISSUER: process.env.KEYCLOAK_ISSUER,
    KEYCLOAK_CLIENT_ID: process.env.KEYCLOAK_CLIENT_ID,
    KEYCLOAK_CLIENT_SECRET: process.env.KEYCLOAK_CLIENT_SECRET,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,
    STORAGE_ROOT: process.env.STORAGE_ROOT,
    UPLOAD_MAX_BYTES: process.env.UPLOAD_MAX_BYTES,
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_API_KEY: process.env.AI_API_KEY,
    AI_MODEL: process.env.AI_MODEL,
    AI_BASE_URL: process.env.AI_BASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  // CI / `next build` without secrets: SKIP_ENV_VALIDATION=1
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
