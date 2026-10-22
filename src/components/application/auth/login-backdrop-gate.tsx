"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Shows its children (the dashboard backdrop) on the sign-in route only. It
 * sits in the shared auth layout next to `<main>` instead of inside the page:
 * `main` carries the page-enter transform, and a transformed ancestor would
 * turn the fixed backdrop into a box inside the card column.
 */
export function LoginBackdropGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return pathname === "/login" ? <>{children}</> : null;
}
