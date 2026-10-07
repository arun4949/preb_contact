"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  Notification,
  NotificationViewport,
  type NotificationAction,
  type NotificationStatus,
} from "@/components/base/notification/notification";

/**
 * Toast stack built on BoardUI's Notification + NotificationViewport.
 * `useToast()` returns `toast.success / error / info / neutral(title, opts)`.
 */

export interface ToastOptions {
  description?: ReactNode;
  /** Milliseconds before auto-dismiss. Defaults to 5000; `0` keeps it open. */
  duration?: number;
  actions?: NotificationAction[];
}

interface ToastItem extends ToastOptions {
  id: number;
  title: ReactNode;
  status: NotificationStatus;
}

interface ToastApi {
  show: (status: NotificationStatus, title: ReactNode, options?: ToastOptions) => number;
  success: (title: ReactNode, options?: ToastOptions) => number;
  error: (title: ReactNode, options?: ToastOptions) => number;
  info: (title: ReactNode, options?: ToastOptions) => number;
  neutral: (title: ReactNode, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback((status: NotificationStatus, title: ReactNode, options?: ToastOptions) => {
    const id = nextId++;
    setItems((current) => [...current.slice(-4), { id, status, title, duration: 5000, ...options }]);
    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, options) => show("success", title, options),
      error: (title, options) => show("error", title, { duration: 8000, ...options }),
      info: (title, options) => show("information", title, options),
      neutral: (title, options) => show("neutral", title, options),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <NotificationViewport position="bottom-end">
        {items.map((item) => (
          <Notification
            key={item.id}
            title={item.title}
            description={item.description}
            status={item.status}
            actions={item.actions}
            introDelay={0}
            autoDismissDuration={item.duration && item.duration > 0 ? item.duration : undefined}
            onDismiss={() => dismiss(item.id)}
          />
        ))}
      </NotificationViewport>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
