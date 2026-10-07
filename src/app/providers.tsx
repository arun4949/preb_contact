"use client";

import type { ReactNode } from "react";
import { DirectionProvider } from "@/components/foundations/direction/direction";
import { ToastProvider } from "@/components/base/toast/toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <DirectionProvider locale="en-US">
      <ToastProvider>{children}</ToastProvider>
    </DirectionProvider>
  );
}
