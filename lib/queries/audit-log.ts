import { prisma } from '@/lib/prisma';
import { belongsTo, toHistoryEntry, type AuditRow, type HistoryEntry } from '@/lib/asset-history';
import { requirePermission } from '@/lib/actions/guards';

export interface AuditEntry {
  id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  user_email: string | null;
  created_at: string;
  summary: string;
}

// Table names touched by RBAC-related writes (role/permission/user-role
// management) — used by the Audit Trail page's "สิทธิ์/Role เท่านั้น" filter.
export const RBAC_AUDIT_TABLES = ['roles', 'permissions', 'role_permissions', 'profiles', 'users'];

type LogRow = {
  id: number;
  userId: string;
  action: string;
  tableName: string | null;
  recordId: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
};

function parseJson(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// user ids → emails in one query; unknown ids (deleted users, "system") stay as-is.
async function emailsFor(ids: string[]): Promise<Map<string, string>> {
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u.email]));
}

export async function listAuditLog(limit = 50, tables?: string[]): Promise<AuditEntry[]> {
  const auth = await requirePermission('audit:read');
  if (!auth.ok) throw new Error(auth.error.message);

  const data: LogRow[] = await prisma.activityLog.findMany({
    where: tables && tables.length > 0 ? { tableName: { in: tables } } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  const emailByUid = await emailsFor(data.map((d) => d.userId));

  return data.map((d) => ({
    id: String(d.id),
    action: d.action,
    table_name: d.tableName ?? 'auth',
    record_id: d.recordId,
    user_email: d.userId === 'system' ? 'system' : (emailByUid.get(d.userId) ?? d.userId),
    created_at: d.createdAt.toISOString(),
    summary: d.newValue
      ? d.newValue.slice(0, 80)
      : d.oldValue
        ? `deleted: ${d.oldValue.slice(0, 60)}`
        : '—',
  }));
}

// One machine's change history, newest first (the machine page's "ประวัติ" tab).
// Same rule as the old audit_log RLS: only roles with audit:read see it.
export async function getAssetHistory(assetId: string, limit = 50): Promise<HistoryEntry[]> {
  const auth = await requirePermission('audit:read');
  if (!auth.ok) return [];
  const [own, readings] = await Promise.all([
    prisma.activityLog.findMany({
      where: { recordId: assetId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.activityLog.findMany({
      where: { recordId: { startsWith: `${assetId}/` } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
  ]);
  const data = [...own, ...readings].filter((d) => belongsTo(d.recordId, assetId));
  const emailByUid = await emailsFor(data.map((d) => d.userId));
  const rows: AuditRow[] = data.map((d) => ({
    id: String(d.id),
    action: d.action,
    table_name: d.tableName ?? '',
    record_id: d.recordId,
    old_value: parseJson(d.oldValue),
    new_value: parseJson(d.newValue),
    created_at: d.createdAt.toISOString(),
    who: d.userId === 'system' ? 'system' : (emailByUid.get(d.userId) ?? d.userId),
  }));
  return rows
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map(toHistoryEntry);
}
