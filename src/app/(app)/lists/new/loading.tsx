import { Skeleton } from "@/components/base/skeleton/skeleton";

/** Wizard-shaped skeleton: title row, source cards, drop zone. */
export default function NewListLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton shape="text" className="w-32" />
        <Skeleton shape="text" className="w-80" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-[280px] rounded-3xl" />
    </div>
  );
}
