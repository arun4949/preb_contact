import { Skeleton, SkeletonRows } from "@/components/base/skeleton/skeleton";

export default function ListDetailLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-2lg" />
          <Skeleton className="h-9 w-9 rounded-2lg" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[132px] rounded-2xl" />
        ))}
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-40 rounded-2lg" />
      </div>
      <div className="flex items-start gap-6">
        <Skeleton className="hidden h-[320px] w-[260px] shrink-0 rounded-3xl lg:block" />
        <div className="min-w-0 flex-1 rounded-2xl border border-border-table p-3">
          <SkeletonRows rows={8} columns={6} />
        </div>
      </div>
    </div>
  );
}
