"use client";

import { useEffect, useState } from "react";
import { RiFilter3Line, RiLayoutColumnLine, RiSearchLine } from "@remixicon/react";
import { Badge } from "@/components/base/badges/badge";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Dropdown, DropdownDivider, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { Input } from "@/components/base/input/input";
import { Kbd } from "@/components/base/kbd/kbd";
import { SEARCH_SHORTCUT_ATTR } from "@/components/application/header/use-shortcuts";
import { cx } from "@/utils/cx";
import { CORE_COLUMNS, extraColumnId } from "./columns";

export interface ContactsToolbarProps {
  total: number;
  q: string;
  onSearch: (q: string) => void;
  visibility: Record<string, boolean>;
  onToggleColumn: (id: string, value: boolean) => void;
  onResetColumns: () => void;
  extras: string[];
  enrichFields: string[];
  /** Below `lg`: opens the filter sheet. */
  onOpenFilters: () => void;
  activeFilters: number;
}

/** Search (debounced → URL) · Column settings · Filters (mobile). */
export function ContactsToolbar({ total, q, onSearch, visibility, onToggleColumn, onResetColumns, extras, enrichFields, onOpenFilters, activeFilters }: ContactsToolbarProps) {
  const [search, setSearch] = useState(q);
  const [columnsOpen, setColumnsOpen] = useState(false);

  // URL changed from outside (reset, back button): adopt it (derived state, no effect).
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    setSearch(q);
  }

  // Debounce typing → URL. Compares trimmed so a trailing space can't loop.
  useEffect(() => {
    if (search.trim() === q) return;
    const t = setTimeout(() => onSearch(search), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, q]);

  const hiddenByField = (id: string) =>
    (id === "personal_email" && !enrichFields.includes("personal_email")) || (id === "phone" && !enrichFields.includes("mobile_phone"));

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-0 flex-1 basis-[240px]">
        <Input
          aria-label="Search contacts"
          placeholder={`Search ${total.toLocaleString("en-US")} contacts…`}
          leadingIcon={RiSearchLine}
          value={search}
          onChange={setSearch}
          {...{ [SEARCH_SHORTCUT_ATTR]: "" }}
        />
        <Kbd className="pointer-events-none absolute end-2.5 top-1/2 hidden -translate-y-1/2 sm:inline-flex">/</Kbd>
      </div>

      <Button variant="secondary" leadingIcon={RiFilter3Line} className="lg:hidden" onClick={onOpenFilters}>
        Filters
        {activeFilters > 0 ? <Badge className="ms-1">{activeFilters}</Badge> : null}
      </Button>

      <Dropdown isOpen={columnsOpen} onOpenChange={setColumnsOpen}>
        <DropdownTrigger
          className={cx(
            "inline-flex h-9 items-center gap-1.5 rounded-2lg border border-border-button-default bg-background-primary-default px-3 text-body-medium text-text-primary shadow-xs",
            "transition-colors hover:border-border-button-hover hover:bg-background-primary-hover",
          )}
        >
          <RiLayoutColumnLine className="size-5 text-foreground-icon-primary" aria-hidden />
          <span className="hidden sm:inline">Column settings</span>
          <span className="sm:hidden">Columns</span>
        </DropdownTrigger>
        <DropdownPopover aria-label="Column settings" placement="bottom end" className="max-h-[70vh] w-[260px] overflow-y-auto">
          <DropdownGroup label="Columns">
            {CORE_COLUMNS.filter((c) => !("always" in c && c.always) && !hiddenByField(c.id)).map((c) => (
              <ColumnRow key={c.id} id={c.id} label={c.label} checked={visibility[c.id] ?? true} onChange={(v) => onToggleColumn(c.id, v)} />
            ))}
          </DropdownGroup>
          {extras.length > 0 ? (
            <>
              <DropdownDivider />
              <DropdownGroup label="From your file">
                {extras.map((h) => (
                  <ColumnRow key={h} id={extraColumnId(h)} label={h} checked={visibility[extraColumnId(h)] ?? false} onChange={(v) => onToggleColumn(extraColumnId(h), v)} />
                ))}
              </DropdownGroup>
            </>
          ) : null}
          <DropdownDivider />
          <DropdownGroup>
            <DropdownItem onSelect={() => { onResetColumns(); setColumnsOpen(false); }}>
              <span className="text-body-medium text-text-secondary">Reset to defaults</span>
            </DropdownItem>
          </DropdownGroup>
        </DropdownPopover>
      </Dropdown>
    </div>
  );
}

function ColumnRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={`col-${id}`} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-background-secondary-hover">
      <Checkbox id={`col-${id}`} slot={null} aria-label={label} isSelected={checked} onChange={(v) => onChange(!!v)} />
      <span className="truncate text-body-medium text-text-primary">{label}</span>
    </label>
  );
}
