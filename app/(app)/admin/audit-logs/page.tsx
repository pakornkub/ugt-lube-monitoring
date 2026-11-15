import Link from 'next/link';
import { History as HistoryIcon, ShieldCheck } from 'lucide-react';
import { listAuditLog, RBAC_AUDIT_TABLES } from '@/lib/queries/audit-log';
import { hasPermission } from '@/lib/queries/permissions';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

const ACTION_CLS: Record<string, string> = {
  INSERT: 'badge-ok',
  UPDATE: '',
  DELETE: 'badge-crit',
};

export default async function AuditLogPage(props: { searchParams: Promise<{ rbac?: string }> }) {
  const searchParams = await props.searchParams;
  if (!(await hasPermission('audit:read'))) redirect('/dashboard');

  const t = await getTranslations('app.auditLogs');
  const rbacOnly = searchParams.rbac === '1';
  const logs = await listAuditLog(50, rbacOnly ? RBAC_AUDIT_TABLES : undefined);

  return (
    <div className="fade space-y-3">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="page-title flex items-center gap-2.5 font-sans text-[22px] font-bold max-sm:text-[18px]">
              <HistoryIcon className="h-4 w-4" aria-hidden />
              {t('title')}
            </h2>
            <div className="text-[14px] text-t2">{t('subtitle')}</div>
          </div>
          <div className="flex gap-1">
            <Link href="/admin/audit-logs">
              <span
                className={`inline-flex items-center rounded-pill border px-2.5 py-1 text-[14px] font-semibold transition ${!rbacOnly ? 'border-cyan bg-cyan/10 text-cyan' : 'border-border text-t2'}`}
              >
                {t('filterAll')}
              </span>
            </Link>
            <Link href="/admin/audit-logs?rbac=1">
              <span
                className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-[14px] font-semibold transition ${rbacOnly ? 'border-cyan bg-cyan/10 text-cyan' : 'border-border text-t2'}`}
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                {t('filterRbac')}
              </span>
            </Link>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="max-h-[600px] overflow-auto">
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr className="sticky top-0 border-b border-border bg-bg2 text-[13px] text-t3">
                <th scope="col" className="px-2.5 py-2">
                  {t('colTime')}
                </th>
                <th scope="col">Action</th>
                <th scope="col">Table</th>
                <th scope="col">Record</th>
                <th scope="col">{t('colUser')}</th>
                <th scope="col">{t('colDetail')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2.5 py-4 text-center text-t3">
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-black/2.5 hover:bg-cyan/2.5">
                    <td className="px-2.5 py-1.5 font-mono whitespace-nowrap text-t3">
                      {log.created_at?.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td>
                      <span
                        className={`badge ${ACTION_CLS[log.action] ?? ''}`}
                        style={
                          !ACTION_CLS[log.action]
                            ? {
                                background: 'rgba(0,102,204,.12)',
                                color: '#0066cc',
                                border: '1px solid rgba(0,102,204,.3)',
                              }
                            : {}
                        }
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="font-mono text-t2">{log.table_name}</td>
                    <td className="max-w-[100px] truncate font-mono text-cyan">
                      {log.record_id ?? '—'}
                    </td>
                    <td className="max-w-[120px] truncate text-t3">{log.user_email}</td>
                    <td className="max-w-[250px] truncate text-t2">{log.summary}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
