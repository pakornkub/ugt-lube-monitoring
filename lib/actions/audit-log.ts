'use server';

import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/profile';

// Insert an audit entry (ActivityLogs) — call after any data mutation. Never throws:
// a failed audit write must not undo or block the change the user just made.
export async function logAudit(opts: {
  action: string;
  table_name: string;
  record_id?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
}): Promise<void> {
  try {
    const user = await getSessionUser();
    await prisma.activityLog.create({
      data: {
        userId: user?.id ?? 'system',
        action: opts.action,
        tableName: opts.table_name,
        recordId: opts.record_id ?? null,
        oldValue: opts.old_value ? JSON.stringify(opts.old_value) : null,
        newValue: opts.new_value ? JSON.stringify(opts.new_value) : null,
      },
    });
  } catch {
    // audit log failure should never block the main operation
  }
}
