import { Skeleton, SkeletonCard } from "@/components/base/skeleton/skeleton";

export default function ListsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading lists">
      <div className="flex items-center gap-3">
        <Skeleton shape="circle" className="size-10" />
        <div className="flex flex-col gap-2">
          <Skeleton shape="text" className="w-28" />
          <Skeleton shape="text" className="w-72" />
        </div>
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-32 rounded-2lg" />
        <Skeleton className="h-9 w-40 rounded-2lg" />
        <Skeleton className="ms-auto h-9 w-64 rounded-2lg" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
