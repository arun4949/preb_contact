"use client";

import { useCallback, useOptimistic, useTransition } from "react";
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

function applyPatch(current: ContactQuery, patch: QueryPatch): ContactQuery {
  const resetsPage = Object.keys(patch).some((k) => k !== "page");
  return {
    ...current,
    ...("size" in patch && patch.size != null
      ? { pageSize: patch.size as ContactQuery["pageSize"] }
      : {}),
    sort: patch.sort ?? current.sort,
    dir: patch.dir ?? current.dir,
    q: patch.q ?? current.q,
    email: patch.email ?? current.email,
    phone: "phone" in patch ? (patch.phone ?? null) : current.phone,
    page: resetsPage ? 1 : (patch.page ?? current.page),
  };
}

/**
 * Table state lives in the URL (`?page&size&sort&dir&q&email&phone`) so the
 * server component re-queries; any change except paging resets to page 1.
 * `query` is optimistic: a chip or a ring segment reads as selected the
 * moment it is clicked, while `pending` is true until the server page with
 * the new rows has arrived.
 */
export function useContactQuery(current: ContactQuery) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const [query, setOptimistic] = useOptimistic(current, applyPatch);

  const set = useCallback(
    (patch: QueryPatch) => {
      const params = new URLSearchParams(searchParams.toString());
      const put = (
        k: string,
        v: string | number | null | undefined,
        def: string | number | null,
      ) => {
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
      start(() => {
        setOptimistic(patch);
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [current, pathname, router, searchParams, setOptimistic],
  );

  const reset = useCallback(
    () => set({ q: "", email: "all", phone: null, page: 1 }),
    [set],
  );

  return { query, set, reset, pending };
}
