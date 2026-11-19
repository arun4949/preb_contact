import { Skeleton, SkeletonRows } from "@/components/base/skeleton/skeleton";

export default function AdminSourcesLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy aria-label="Loading acquisition sources">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-[560px]" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-full max-w-[340px] rounded-2lg" />
        <Skeleton className="h-9 w-full max-w-[280px] rounded-2lg" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-[92px] rounded-3xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
      <div className="rounded-2xl border border-border-table p-3">
        <SkeletonRows rows={8} columns={6} />
      </div>
    </div>
  );
}
