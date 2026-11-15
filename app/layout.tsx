import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Geist_Mono, Inter, Noto_Sans_Thai } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import './globals.css';
import { QueryProvider } from '@/components/query-provider';
import { QueryProgress } from '@/components/ui/query-progress';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { ToastProvider } from '@/components/ui/Toast';
import { DevEnvironmentBar } from '@/components/dev-environment-bar';
import { isDevEnvironment } from '@/lib/environment';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const notoSansThai = Noto_Sans_Thai({ subsets: ['thai'], variable: '--font-noto-sans-thai' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

const APP_NAME = 'UGT Reliability Lube Monitoring';
const DEV_PREFIX = isDevEnvironment() ? '[DEV] ' : '';

export const metadata: Metadata = {
  title: { template: `${DEV_PREFIX}%s · ${APP_NAME}`, default: `${DEV_PREFIX}${APP_NAME}` },
  description: 'Condition Monitoring & Reliability Platform',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  // proxy.ts issues a per-request CSP nonce; next-themes' no-flash script needs it.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${notoSansThai.variable} ${geistMono.variable}`}
    >
      <body>
        <NextIntlClientProvider>
          {isDevEnvironment() && <DevEnvironmentBar />}
          <QueryProvider>
            <QueryProgress />
            {/* attribute: `class` drives the kit's dark variant, `data-theme` the app's own
                tokens; storageKey keeps the theme people already picked. */}
            <ThemeProvider attribute={['class', 'data-theme']} storageKey="ugt-theme" nonce={nonce}>
              <TooltipProvider delay={0}>
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-cyan focus:px-4 focus:py-2 focus:text-white"
                >
                  ข้ามไปยังเนื้อหาหลัก
                </a>
                <ToastProvider>{children}</ToastProvider>
                <Toaster richColors />
              </TooltipProvider>
            </ThemeProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
