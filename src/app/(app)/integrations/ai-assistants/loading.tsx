import { Skeleton } from "@/components/base/skeleton/skeleton";

export default function IntegrationsLoading() {
  return (
    <div className="flex flex-col gap-10" aria-busy aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton shape="text" className="w-40" />
        <Skeleton shape="text" className="w-80" />
      </div>
      <Skeleton className="h-[280px] rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-[200px] rounded-3xl" />
        <Skeleton className="h-[200px] rounded-3xl" />
        <Skeleton className="h-[200px] rounded-3xl" />
      </div>
    </div>
  );
}
