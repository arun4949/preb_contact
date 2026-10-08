import { Skeleton, SkeletonRows } from "@/components/base/skeleton/skeleton";

/** Group-level fallback for pages without their own skeleton. */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton shape="text" className="w-40" />
        <Skeleton shape="text" className="w-72" />
      </div>
      <SkeletonRows />
    </div>
  );
}
