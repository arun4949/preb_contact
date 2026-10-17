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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[148px] rounded-3xl" />
        ))}
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-40 rounded-2lg" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="rounded-2xl border border-border-table p-3">
        <SkeletonRows rows={8} columns={6} />
      </div>
    </div>
  );
}
