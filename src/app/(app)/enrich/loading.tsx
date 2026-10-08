import { Skeleton, SkeletonRows } from "@/components/base/skeleton/skeleton";

export default function EnrichLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton shape="text" className="w-40" />
        <Skeleton shape="text" className="w-80" />
      </div>
      <Skeleton className="h-[360px] rounded-3xl" />
      <div className="flex flex-col gap-3">
        <Skeleton shape="text" className="w-48" />
        <SkeletonRows />
      </div>
    </div>
  );
}
