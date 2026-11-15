import { TableSkeleton } from '@/components/ui/LoadingSkeletons';

export default function Loading() {
  return (
    <div className="fade">
      <TableSkeleton rows={10} />
    </div>
  );
}
