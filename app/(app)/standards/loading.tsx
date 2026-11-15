import { ToolbarSkeleton, CardGridSkeleton } from '@/components/ui/LoadingSkeletons';

export default function Loading() {
  return (
    <div className="fade">
      <ToolbarSkeleton />
      <CardGridSkeleton count={9} />
    </div>
  );
}
