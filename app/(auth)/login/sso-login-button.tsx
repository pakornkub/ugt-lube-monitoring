'use client';

import { useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

// process.env directly: NEXT_PUBLIC_* read through createEnv() is '' in the client bundle.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function SsoLoginButton({ from }: Readonly<{ from: string }>) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setErr(null);
    // callbackURL must carry the basePath itself (Better Auth does not know it).
    const { error } = await authClient.signIn.social({
      provider: 'keycloak',
      callbackURL: `${BASE_PATH}${from}`,
    });
    if (error) {
      setErr('เชื่อมต่อระบบ SSO ไม่สำเร็จ กรุณาลองใหม่');
      setBusy(false);
    }
  }

  return (
    <>
      {err && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-[14px] text-red"
        >
          {err}
        </div>
      )}
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan py-2.5 text-[15px] font-bold text-white transition hover:bg-cyan-focus disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Building2 className="h-4 w-4" aria-hidden />
        )}
        {busy ? 'กำลังไปยังหน้าเข้าสู่ระบบ…' : 'เข้าสู่ระบบด้วย SSO (บัญชีบริษัท)'}
      </button>
    </>
  );
}
