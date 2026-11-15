import { listUsers, NO_ROLE_TAB } from '@/lib/queries/users';
import { hasPermission, listRoles } from '@/lib/queries/permissions';
import { getReference } from '@/lib/queries/assets';
import { redirect } from 'next/navigation';
import { UsersClient } from '@/components/admin/UsersClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string; tab?: string }>;
}

export default async function UsersPage(props: PageProps) {
  const searchParams = await props.searchParams;
  if (!(await hasPermission('users:manage'))) redirect('/dashboard');

  const q = searchParams.q ?? '';
  const page = Number(searchParams.page ?? '1') || 1;
  const pageSize = Number(searchParams.pageSize ?? '20') || 20;
  const tab = searchParams.tab === NO_ROLE_TAB ? NO_ROLE_TAB : '';

  const [list, roles, reference] = await Promise.all([
    listUsers({ q, page, pageSize, tab }),
    listRoles(),
    getReference(),
  ]);
  return <UsersClient list={list} q={q} tab={tab} roles={roles} sites={reference.sites} />;
}
