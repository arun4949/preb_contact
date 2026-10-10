"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export const CORE_COLUMNS = [
  { id: "name", label: "Name", always: true },
  { id: "job_title", label: "Job title" },
  { id: "company", label: "Company" },
  { id: "location", label: "Location" },
  { id: "personal_email", label: "Personal email" },
  { id: "phone", label: "Phone" },
  { id: "work_email", label: "Work email" },
  { id: "status", label: "Status" },
] as const;

export type CoreColumnId = (typeof CORE_COLUMNS)[number]["id"];
export const extraColumnId = (header: string) => `extra:${header}`;

const STORAGE_KEY = "preb:list-columns:v1";
const EMPTY: Record<string, boolean> = {};

/* Tiny external store over localStorage so SSR renders defaults and the
 * client adopts the saved overrides without a setState-in-effect. */
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: Record<string, boolean> = EMPTY;

function readOverrides(): Record<string, boolean> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    cachedValue = raw ? (JSON.parse(raw) as Record<string, boolean>) : EMPTY;
  } catch {
    cachedValue = EMPTY;
  }
  return cachedValue;
}

function writeOverrides(next: Record<string, boolean> | null) {
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: the choice just doesn't persist.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * Column visibility per user (localStorage). Defaults: core columns visible
 * except the ones whose field wasn't enriched; pass-through columns hidden.
 */
export function useColumnVisibility(enrichFields: string[], extras: string[]) {
  const defaults = useMemo(() => {
    const v: Record<string, boolean> = {};
    for (const c of CORE_COLUMNS) v[c.id] = true;
    v.personal_email = enrichFields.includes("personal_email");
    v.phone = enrichFields.includes("mobile_phone");
    for (const h of extras) v[extraColumnId(h)] = false;
    return v;
  }, [enrichFields, extras]);

  const overrides = useSyncExternalStore(subscribe, readOverrides, () => EMPTY);
  const visibility = useMemo(() => ({ ...defaults, ...overrides, name: true }), [defaults, overrides]);

  const toggle = useCallback((id: string, value: boolean) => {
    writeOverrides({ ...readOverrides(), [id]: value });
  }, []);

  const resetColumns = useCallback(() => writeOverrides(null), []);

  return { visibility, toggle, resetColumns };
}
