import type { ReactNode } from "react";
import { RiAlertFill, RiInformationFill, RiLightbulbFlashFill } from "@remixicon/react";
import type { DocsCalloutTone } from "@/lib/docs/types";
import { cx } from "@/utils/cx";

/**
 * Typography for help center articles. Server-safe, tokens only. The block
 * renderer (`docs-article.tsx`) is the only consumer, so every article reads
 * the same.
 */

/** A button, field or menu name exactly as the app shows it. */
export function UiLabel({ children }: { children: ReactNode }) {
  return <strong className="text-body-medium text-text-primary">{children}</strong>;
}

export function DocsH2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mt-4 scroll-mt-24 text-title-3-semibold text-text-primary first:mt-0">
      {children}
    </h2>
  );
}

export function DocsH3({ children }: { children: ReactNode }) {
  return <h3 className="mt-2 text-headline-medium text-text-primary">{children}</h3>;
}

export function DocsP({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-body-regular text-text-primary", className)}>{children}</p>;
}

export function DocsSteps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-background-secondary-default text-caption-1-semibold text-text-secondary tabular-nums" aria-hidden>
            {i + 1}
          </span>
          <span className="min-w-0 text-body-regular text-text-primary">{item}</span>
        </li>
      ))}
    </ol>
  );
}

export function DocsList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 ps-5 marker:text-text-tertiary">
      {items.map((item, i) => (
        <li key={i} className="ps-1 text-body-regular text-text-primary">
          {item}
        </li>
      ))}
    </ul>
  );
}

const CALLOUT: Record<DocsCalloutTone, { label: string; icon: typeof RiInformationFill; wrap: string; icon_: string }> = {
  note: { label: "Note", icon: RiInformationFill, wrap: "border-border-button-default bg-background-secondary-default", icon_: "text-notification-information-foreground" },
  tip: { label: "Tip", icon: RiLightbulbFlashFill, wrap: "border-border-button-default bg-notification-success-background", icon_: "text-notification-success-foreground" },
  important: { label: "Important", icon: RiAlertFill, wrap: "border-border-button-default bg-status-orange-background", icon_: "text-status-orange-text" },
};

/** Same recipe as the base Banner, with a tone label so the meaning survives without colour. */
export function DocsCallout({ tone, title, children }: { tone: DocsCalloutTone; title?: ReactNode; children: ReactNode }) {
  const t = CALLOUT[tone];
  const Icon = t.icon;
  return (
    <div role="note" className={cx("flex items-start gap-3 rounded-xl border px-4 py-3", t.wrap)}>
      <Icon className={cx("mt-0.5 size-5 shrink-0", t.icon_)} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-body-medium text-text-primary">{title ?? t.label}</p>
        <div className="text-body-regular text-text-secondary">{children}</div>
      </div>
    </div>
  );
}

/** Static table on the dashboard table recipe (`.bui-table`, styles/globals.css). */
export function DocsTable({ columns, rows }: { columns: ReactNode[]; rows: ReactNode[][] }) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-border-table">
      <table className="bui-table bui-table-sm w-full">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} scope="col" className="text-start">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className={cx("align-top", c === 0 && "text-body-medium text-text-primary")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
