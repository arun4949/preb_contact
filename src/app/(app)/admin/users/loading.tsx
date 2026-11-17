import { Skeleton, SkeletonRows } from "@/components/base/skeleton/skeleton";

export default function AdminAccountsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading accounts">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full max-w-[520px]" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-full max-w-[380px] rounded-2lg" />
        <Skeleton className="ms-auto h-9 w-full rounded-2lg sm:w-[320px]" />
      </div>
      <div className="rounded-2xl border border-border-table p-3">
        <SkeletonRows rows={10} columns={8} />
      </div>
    </div>
  );
}
