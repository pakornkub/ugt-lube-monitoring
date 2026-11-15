import { prisma } from '@/lib/prisma';
import { dateOnly } from '@/lib/db/json';
import { siteWhere } from '@/lib/queries/permissions';
import type { MaintenanceRecord } from '@/lib/types';

export async function listMaintenance(assetId: string): Promise<MaintenanceRecord[]> {
  const rows = await prisma.maintenanceRecord.findMany({
    where: { asset_id: assetId, asset: await siteWhere() },
    select: {
      id: true,
      asset_id: true,
      type: true,
      work_date: true,
      wo_no: true,
      description: true,
      parts: true,
      cost: true,
      technician: true,
    },
    orderBy: { work_date: 'desc' },
  });
  return rows.map((r) => ({
    ...r,
    type: r.type as MaintenanceRecord['type'],
    work_date: dateOnly(r.work_date),
  }));
}
