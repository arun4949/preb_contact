"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RiSearchLine } from "@remixicon/react";
import { Input } from "@/components/base/input/input";
import { Kbd } from "@/components/base/kbd/kbd";
import { Select, SelectItem } from "@/components/base/select/select";
import { StatusDot } from "@/components/base/badges/status-dot";
import { SEARCH_SHORTCUT_ATTR } from "@/components/application/header/use-shortcuts";
import { cx } from "@/utils/cx";

export interface ListsToolbarProps {
  status: string;
  owner: string;
  q: string;
  members: { id: string; name: string; isMe: boolean }[];
}

const STATUS_OPTIONS = [
  { id: "all", label: "All lists", dot: null },
  { id: "enriching", label: "Enriching", dot: "indigo" as const },
  { id: "completed", label: "Completed", dot: "green" as const },
  { id: "paused", label: "Paused", dot: "yellow" as const },
];

/** Filters live in the URL so the server component re-queries; search is debounced. */
export function ListsToolbar({ status, owner, q, members }: ListsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState(q);
  const first = useRef(true);

  const apply = (next: Partial<{ status: string; owner: string; q: string }>) => {
    const params = new URLSearchParams();
    const s = next.status ?? status;
    const o = next.owner ?? owner;
    const query = next.q ?? search;
    if (s && s !== "all") params.set("status", s);
    if (o && o !== "all") params.set("owner", o);
    if (query.trim()) params.set("q", query.trim());
    const qs = params.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => apply({ q: search }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const ownerItems = [
    { id: "all", label: "Everyone" },
    { id: "me", label: "Me" },
    ...members.filter((m) => !m.isMe).map((m) => ({ id: m.id, label: m.name })),
  ];

  return (
    <div className={cx("flex flex-wrap items-center gap-3 transition-opacity", pending && "opacity-70")}>
      <Select aria-label="Status" selectedKey={status} onSelectionChange={(key) => apply({ status: String(key) })} popoverClassName="w-[200px]">
        {STATUS_OPTIONS.map((o) => (
          <SelectItem key={o.id} id={o.id} textValue={o.label}>
            {o.dot ? <StatusDot color={o.dot} className="me-1" /> : null}
            {o.label}
          </SelectItem>
        ))}
      </Select>
      <Select
        aria-label="Owner"
        selectedKey={ownerItems.some((o) => o.id === owner) ? owner : "all"}
        onSelectionChange={(key) => apply({ owner: String(key) })}
        renderValue={({ selectedText }) => <span className="truncate">Owned by: {selectedText}</span>}
        popoverClassName="w-[240px]"
      >
        {ownerItems.map((o) => (
          <SelectItem key={o.id} id={o.id} textValue={o.label}>
            {o.label}
          </SelectItem>
        ))}
      </Select>
      <div className="ms-auto w-full sm:w-[280px]">
        <Input
          aria-label="Search lists"
          placeholder="Search lists…"
          leadingIcon={RiSearchLine}
          value={search}
          onChange={setSearch}
          {...{ [SEARCH_SHORTCUT_ATTR]: "" }}
        />
      </div>
      <Kbd className="hidden sm:inline-flex" aria-hidden>
        /
      </Kbd>
    </div>
  );
}
