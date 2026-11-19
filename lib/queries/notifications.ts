import { prisma } from '@/lib/prisma';
import { parseList } from '@/lib/db/json';
import type { NotificationConfig } from '@/lib/types';

const DEFAULT_CONFIG: NotificationConfig = {
  id: 1,
  email_recipients: [],
  enable_critical_alerts: true,
  enable_weekly_summary: false,
};

// Same row for every caller (the weekly-digest cron has no session; the config is
// readable by any signed-in user, as before).
export async function getNotificationConfig(): Promise<NotificationConfig> {
  const row = await prisma.notificationConfig.findUnique({ where: { id: 1 } });
  if (!row) return DEFAULT_CONFIG;
  return {
    id: row.id,
    email_recipients: parseList(row.email_recipients),
    enable_critical_alerts: row.enable_critical_alerts,
    enable_weekly_summary: row.enable_weekly_summary,
  };
}
