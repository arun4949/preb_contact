import type { ReactNode } from "react";
import { Banner } from "@/components/base/banner/banner";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { cx } from "@/utils/cx";

/** Building blocks of the admin account page. No hooks, so server components can use them. */

export function StatTile({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "bad" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-3xl border border-border-button-default bg-background-primary-default p-4">
      <span className="text-body-2-regular text-text-secondary">{label}</span>
      <span className={cx("truncate text-title-3-semibold tabular-nums", tone === "bad" ? "text-text-error-primary" : "text-text-primary")}>{value}</span>
      {hint ? <span className="truncate text-caption-1-regular text-text-tertiary">{hint}</span> : null}
    </div>
  );
}

export function Card({ title, description, action, children, className }: { title: string; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("flex min-w-0 flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-headline-medium text-text-primary">{title}</h2>
          {description ? <p className="text-body-2-regular text-text-secondary">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A table section outside a card: title, optional controls, then the table. */
export function Block({ title, description, action, children }: { title: string; description?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-headline-medium text-text-primary">{title}</h2>
          {description ? <p className="text-body-2-regular text-text-secondary">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Label and value pairs, two columns from the small breakpoint up. */
export function Fields({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">{children}</dl>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-body-2-regular text-text-secondary">{label}</dt>
      <dd className="min-w-0 text-body-medium text-text-primary">{children}</dd>
    </div>
  );
}

/** A failed query is shown as such, never as an empty section. */
export function PartError({ title, error }: { title: string; error: string }) {
  return (
    <Banner tone="error" title={title}>
      {error}
    </Banner>
  );
}

export function Nothing({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-background-secondary-default">
      <EmptyState size="inline" title={text} />
    </div>
  );
}

export const Muted = ({ children }: { children: ReactNode }) => <span className="text-text-tertiary">{children}</span>;

/** "paused_credits" → "Paused credits" */
export function humanize(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
