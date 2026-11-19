import { LogOut } from 'lucide-react';
import { ssoLogoutAction } from '@/lib/actions/auth';

// SSO logout = delete the local session + backchannel logout to Keycloak (org
// standard). A form action, never the auth-client's signOut().
export function LogoutButton() {
  return (
    <form action={ssoLogoutAction}>
      <button
        type="submit"
        aria-label="ออกจากระบบ"
        title="ออกจากระบบ"
        className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[13px] font-semibold text-t2 hover:border-cyan hover:text-cyan"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden />
        <span className="max-[760px]:hidden">ออกจากระบบ</span>
      </button>
    </form>
  );
}
