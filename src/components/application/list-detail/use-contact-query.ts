"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ContactQuery } from "@/lib/lists/contact-query";

export type QueryPatch = Partial<{
  page: number;
  size: number;
  sort: ContactQuery["sort"];
  dir: ContactQuery["dir"];
  q: string;
  email: ContactQuery["email"];
  phone: ContactQuery["phone"];
}>;

/**
 * Table state lives in the URL (`?page&size&sort&dir&q&email&phone`) so the
 * server component re-queries; any change except paging resets to page 1.
 */
export function useContactQuery(current: ContactQuery) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();

  const set = useCallback(
    (patch: QueryPatch) => {
      const params = new URLSearchParams(searchParams.toString());
      const put = (k: string, v: string | number | null | undefined, def: string | number | null) => {
        if (v == null || v === "" || v === def) params.delete(k);
        else params.set(k, String(v));
      };
      const next = { ...current, ...patch };
      const resetsPage = Object.keys(patch).some((k) => k !== "page");
      put("page", resetsPage ? 1 : next.page, 1);
      put("size", "size" in patch ? patch.size : next.pageSize, 25);
      put("sort", next.sort, "row");
      put("dir", next.dir, "asc");
      put("q", next.q.trim(), "");
      put("email", next.email, "all");
      put("phone", next.phone, null);
      const qs = params.toString();
      start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [current, pathname, router, searchParams],
  );

  const reset = useCallback(() => set({ q: "", email: "all", phone: null, page: 1 }), [set]);

  return { set, reset, pending };
}
