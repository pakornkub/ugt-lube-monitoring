import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Settings, TriangleAlert } from 'lucide-react';
import { auth } from '@/lib/auth';
import { SsoLoginButton } from './sso-login-button';

export const dynamic = 'force-dynamic';

// The app's own login card (DESIGN.md §10: kept instead of the kit's LoginShell —
// preserve mode). Sign-in is Keycloak SSO only; accounts appear on first login.
const SSO_ERRORS: Record<string, string> = {
  unable_to_create_user:
    'เข้าสู่ระบบสำเร็จ แต่สร้างบัญชีผู้ใช้ไม่สำเร็จ กรุณาแจ้งผู้ดูแลระบบ (unable_to_create_user)',
  account_not_linked: 'บัญชีนี้ยังเชื่อมกับระบบไม่ได้ กรุณาแจ้งผู้ดูแลระบบ (account_not_linked)',
  sso_refused:
    'ระบบปฏิเสธการเข้าสู่ระบบด้วย SSO เพราะอีเมลนี้เป็นของบัญชีอื่น หรือข้อมูลตัวตนจาก SSO ไม่ครบ กรุณาแจ้งผู้ดูแลระบบ (sso_refused)',
};

// Open-redirect guard: only an in-app path may come back from ?from=.
function sanitizeFrom(from: string | undefined): string {
  if (!from || !from.startsWith('/') || from.startsWith('//') || from.startsWith('/\\'))
    return '/dashboard';
  return from;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; error?: string; from?: string }>;
}) {
  // Already signed in (a REAL session, not just a cookie) → into the app.
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect('/dashboard');

  const { reason, error, from } = await searchParams;
  const banner =
    reason === 'session_expired'
      ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง'
      : error
        ? (SSO_ERRORS[error] ?? `เข้าสู่ระบบไม่สำเร็จ กรุณาแจ้งผู้ดูแลระบบ (${error})`)
        : null;

  return (
    <main className="rounded-xl border border-white/10 bg-white/4 p-7 shadow-2xl backdrop-blur-xl">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-dark text-[26px] font-extrabold text-white shadow-lg">
          <Settings className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="font-sans text-[20px] font-bold text-white">UGT RELIABILITY</h1>
        <p className="mt-0.5 text-[13px] font-semibold text-cyan-dark">Lube Monitoring</p>
      </div>

      {banner && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-1.5 rounded-lg border border-yellow/30 bg-yellow/10 px-3 py-2 text-[14px] text-yellow"
        >
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {banner}
        </div>
      )}

      <SsoLoginButton from={sanitizeFrom(from)} />

      <p className="mt-4 text-center text-[14px] text-white/40">
        ใช้บัญชีเดียวกับคอมพิวเตอร์บริษัท (AD) · สิทธิ์การใช้งานกำหนดโดยผู้ดูแลระบบ
      </p>
    </main>
  );
}
