import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// next-intl finds i18n/request.ts only through this plugin — without it every t() throws.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Deployed under a shared domain: /ugt-lube-monitoring (prod) · /ugt-lube-monitoring-dev (dev).
  // Build-time value (Jenkins passes NEXT_PUBLIC_BASE_PATH as a build arg).
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  // Docker image ships .next/standalone (ugt-nextjs-cicd-setup Dockerfile).
  output: 'standalone',
  // Version-skew protection: Jenkins passes NEXT_DEPLOYMENT_ID (build + commit) to both images.
  deploymentId: process.env.NEXT_DEPLOYMENT_ID || undefined,
  // The SQL Server driver stays a plain Node dependency: tedious → @azure/identity → open
  // references powershell.exe by absolute path, which Turbopack tries (and fails) to bundle.
  serverExternalPackages: ['@prisma/adapter-mssql', 'mssql', 'tedious'],
  // Security headers + the per-request CSP nonce are set in proxy.ts.
  poweredByHeader: false,
};

export default withNextIntl(nextConfig);
