import type { appTh } from './app.th';

type AppCatalog = { [N in keyof typeof appTh]: Record<keyof (typeof appTh)[N], string> };

export const appEn: AppCatalog = {
  auditLogs: {
    title: 'Audit Trail',
    subtitle: 'Every data change is recorded — for ISO audits and traceability',
    filterAll: 'All',
    filterRbac: 'Roles/permissions only',
    colTime: 'Time',
    colUser: 'Changed by',
    colDetail: 'Details',
    empty: 'No history yet',
  },
  upload: {
    badRequest: 'Invalid request',
    badPeriod: 'Invalid period',
    badKind: 'Invalid reading type',
    standardNotFound: 'Standard not found',
    uploaded: 'File attached',
  },
};
