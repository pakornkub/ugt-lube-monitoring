import { redirect } from 'next/navigation';
import { listStandards } from '@/lib/queries/standards';
import { hasPermission } from '@/lib/queries/permissions';
import { StandardsClient } from '@/components/standards/StandardsClient';

export const dynamic = 'force-dynamic';

export default async function StandardsPage(props: { searchParams: Promise<{ q?: string }> }) {
  const searchParams = await props.searchParams;
  if (!(await hasPermission('standards:read'))) redirect('/dashboard');

  const q = searchParams.q ?? '';
  const [standards, canManage, canManageAttachments] = await Promise.all([
    listStandards({ q }),
    hasPermission('standards:write'),
    hasPermission('attachments:write'),
  ]);
  return (
    <StandardsClient
      initialStandards={standards}
      initialQ={q}
      canManage={canManage}
      canManageAttachments={canManageAttachments}
    />
  );
}
