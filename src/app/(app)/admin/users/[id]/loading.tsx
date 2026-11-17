import { Skeleton, SkeletonRows } from "@/components/base/skeleton/skeleton";

export default function AdminAccountLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy aria-label="Loading account">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
        </div>
        <Skeleton className="h-5 w-full max-w-[420px]" />
        <Skeleton className="h-4 w-full max-w-[640px]" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[98px] rounded-3xl" />
        ))}
      </div>
      <div className="flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20" />
        ))}
      </div>
      <div className="rounded-2xl border border-border-table p-3">
        <SkeletonRows rows={8} columns={7} />
      </div>
    </div>
  );
}
