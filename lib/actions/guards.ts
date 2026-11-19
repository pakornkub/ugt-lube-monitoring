import { getOwnPermissions, getSessionUser } from '@/lib/profile';
import { canAccessAsset } from '@/lib/queries/permissions';
import type { ActionResult } from './result';

// Every Server Action with a side effect checks, in order: session → permission →
// (plant scope) → action → audit log. Returns the caller's user id on success
// (used e.g. as CreatedBy/UpdatedBy and to prevent self-delete).

export type GuardResult = { ok: true; userId: string } | { ok: false; error: ActionResult };

// `perm` is a key from lib/permissions.ts (e.g. "assets:write"). Always the user's
// OWN grants — "view as" never widens or narrows what an action may do.
export async function requirePermission(perm: string): Promise<GuardResult> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, error: { ok: false, message: 'Unauthorized: กรุณาเข้าสู่ระบบ' } };
  }
  if (!(await getOwnPermissions(user.id)).includes(perm)) {
    return { ok: false, error: { ok: false, message: `ไม่มีสิทธิ์ดำเนินการนี้ (${perm})` } };
  }
  return { ok: true, userId: user.id };
}

// requirePermission + the machine's plant must be in the user's site scope
// (what the Supabase RLS policies enforced with can_access_site()).
export async function requireAssetPermission(perm: string, assetId: string): Promise<GuardResult> {
  const g = await requirePermission(perm);
  if (!g.ok) return g;
  if (!(await canAccessAsset(assetId))) {
    return { ok: false, error: { ok: false, message: 'ไม่พบเครื่องจักร หรือไม่มีสิทธิ์เข้าถึงโรงงานนี้' } };
  }
  return g;
}
