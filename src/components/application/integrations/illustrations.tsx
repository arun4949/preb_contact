import { RiCheckLine, RiLinksLine, RiSparkling2Line } from "@remixicon/react";
import { cx } from "@/utils/cx";

/**
 * Small token-only illustrations for the Integrations pages. No screenshots
 * and no brand art: a few surfaces and lines that read as "a chat", "an
 * address field" and "an approve card" in both themes.
 */

const frame = "relative flex h-36 w-full items-center justify-center overflow-hidden rounded-2xl bg-background-secondary-default";

/** A chat: the user asks for emails, the assistant answers with a small table. */
export function ChatMock({ className }: { className?: string }) {
  return (
    <div className={cx(frame, "h-auto min-h-44 items-stretch p-4", className)} aria-hidden>
      <div className="flex w-full flex-col gap-3">
        <div className="ms-auto max-w-[78%] rounded-2xl rounded-ee-md bg-accent-600 px-3.5 py-2 text-body-2-regular text-white">
          Find work emails and mobile numbers for these 12 people. Show me the cost first.
        </div>
        <div className="me-auto flex max-w-[88%] flex-col gap-2 rounded-2xl rounded-es-md border border-border-button-default bg-background-primary-default px-3.5 py-2.5">
          <span className="flex items-center gap-1.5 text-caption-1-medium text-text-secondary">
            <RiSparkling2Line className="size-3.5" /> Preb · typically 48 credits, at most 264. Go ahead?
          </span>
          <div className="grid grid-cols-[1.2fr_1.6fr_1fr] gap-x-3 gap-y-1.5 text-caption-1-regular text-text-primary">
            <span className="text-text-tertiary">Name</span>
            <span className="text-text-tertiary">Work email</span>
            <span className="text-text-tertiary">Mobile</span>
            <span>Mara Lindqvist</span>
            <span className="truncate" dir="ltr">mara@northwind.io</span>
            <span className="flex items-center gap-1"><RiCheckLine className="size-3 text-chart-1-active" /> found</span>
            <span>Jonas Petrov</span>
            <span className="truncate" dir="ltr">j.petrov@helio.co</span>
            <span className="flex items-center gap-1"><RiCheckLine className="size-3 text-chart-1-active" /> found</span>
            <span>Aisha Rahman</span>
            <span className="truncate" dir="ltr">aisha@lumen.ai</span>
            <span className="text-text-tertiary">not found</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Step 1: an address field with the server URL being pasted. */
export function AddressMock() {
  return (
    <div className={frame} aria-hidden>
      <div className="flex w-[82%] flex-col gap-2 rounded-xl border border-border-button-default bg-background-primary-default p-3 shadow-xs">
        <span className="text-caption-1-medium text-text-secondary">Add connector</span>
        <span className="flex h-8 items-center gap-2 rounded-lg border border-border-focus-ring bg-background-primary-default px-2 font-mono text-caption-1-regular text-text-primary" dir="ltr">
          <RiLinksLine className="size-3.5 text-foreground-icon-tertiary" />
          app.preb.co/mcp
          <span className="h-4 w-px animate-pulse bg-text-primary" />
        </span>
      </div>
    </div>
  );
}

/** Step 2: the approve card. */
export function ApproveMock() {
  return (
    <div className={frame} aria-hidden>
      <div className="flex w-[82%] flex-col gap-2.5 rounded-xl border border-border-button-default bg-background-primary-default p-3 shadow-xs">
        <span className="text-caption-1-medium text-text-primary">Connect your assistant to Preb</span>
        <span className="flex items-center gap-1.5 text-caption-1-regular text-text-secondary">
          <RiCheckLine className="size-3.5 text-foreground-icon-secondary" /> Find emails and numbers
        </span>
        <span className="flex items-center gap-1.5 text-caption-1-regular text-text-secondary">
          <RiCheckLine className="size-3.5 text-foreground-icon-secondary" /> Check credits and runs
        </span>
        <span className="flex h-7 items-center justify-center rounded-lg bg-accent-600 text-caption-1-semibold text-white">Allow</span>
      </div>
    </div>
  );
}

/** Step 3: a chat bubble. */
export function AskMock() {
  return (
    <div className={frame} aria-hidden>
      <div className="flex w-[82%] flex-col gap-2">
        <span className="ms-auto max-w-[90%] rounded-2xl rounded-ee-md bg-accent-600 px-3 py-1.5 text-caption-1-regular text-white">Who is behind jane@acme.com? Add her LinkedIn and title.</span>
        <span className="me-auto flex items-center gap-1.5 rounded-2xl rounded-es-md border border-border-button-default bg-background-primary-default px-3 py-1.5 text-caption-1-regular text-text-secondary">
          <RiSparkling2Line className="size-3.5" /> Jane Okafor, Head of Talent at Acme…
        </span>
      </div>
    </div>
  );
}
