"use client";

import { useActionState, useState } from "react";
import { RiCheckLine } from "@remixicon/react";
import { Banner } from "@/components/base/banner/banner";
import { Button } from "@/components/base/buttons/button";
import { Select, SelectItem } from "@/components/base/select/select";
import { AssistantLogo } from "@/components/foundations/brand/assistant-logo";
import { Logo } from "@/components/foundations/brand/logo";
import { isKnownRedirectHost, type Assistant } from "@/lib/mcp/clients";
import { approveConnection, denyConnection, type ConsentState } from "@/lib/mcp/consent-actions";

export interface ConsentWorkspace {
  id: string;
  name: string;
  role: string;
}

export interface ConsentCardProps {
  authorizationId: string;
  client: { id: string; name: string; redirectHost: string };
  assistant: Assistant;
  email: string;
  workspaces: ConsentWorkspace[];
  defaultWorkspaceId: string;
}

const CAN = [
  "Find work emails, personal emails and mobile numbers for people you name",
  "Check your credit balance and the status of your runs",
  "Look up contacts you already enriched",
];

/**
 * The approve screen. One hidden form per button so the deny action never
 * needs the workspace; the approve form carries the chosen workspace id.
 */
export function ConsentCard({ authorizationId, client, assistant, email, workspaces, defaultWorkspaceId }: ConsentCardProps) {
  const [workspaceId, setWorkspaceId] = useState(defaultWorkspaceId);
  const [approveState, approve, approving] = useActionState<ConsentState, FormData>(approveConnection, { status: "idle" });
  const [denyState, deny, denying] = useActionState<ConsentState, FormData>(denyConnection, { status: "idle" });
  const error = approveState.status === "error" ? approveState.message : denyState.status === "error" ? denyState.message : null;
  const busy = approving || denying;
  const title = assistant.id === "other" ? client.name || "An AI assistant" : assistant.name;

  return (
    <div className="flex w-full max-w-[440px] flex-col rounded-3xl border border-border-button-default bg-background-primary-default p-6 shadow-xs sm:p-8">
      <div className="mb-5 flex items-center gap-3">
        <AssistantLogo id={assistant.id} size="lg" />
        <span className="flex items-center gap-1 text-foreground-icon-tertiary" aria-hidden>
          <span className="size-1 rounded-full bg-current" />
          <span className="size-1 rounded-full bg-current" />
          <span className="size-1 rounded-full bg-current" />
        </span>
        <span className="flex size-14 items-center justify-center rounded-2xl bg-background-secondary-default">
          <Logo size={32} />
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-title-2-medium text-text-primary">Connect {title} to Preb</h1>
        <p className="text-body-regular text-text-secondary">
          {title} wants to use Preb on your behalf. You are signed in as <span className="text-body-medium text-text-primary" dir="ltr">{email}</span>.
        </p>
      </div>

      {error ? (
        <Banner tone="error" className="mt-5">
          {error}
        </Banner>
      ) : null}

      {!isKnownRedirectHost(client.redirectHost) ? (
        <Banner tone="warning" title="Unknown app" className="mt-5">
          This request comes from an app we do not recognise{client.redirectHost ? `, and it would send you to ${client.redirectHost}` : ""}. Only continue if you started this connection yourself a moment ago. If someone sent you this link, click Cancel.
        </Banner>
      ) : null}

      <ul className="mt-6 flex flex-col gap-2.5">
        {CAN.map((line) => (
          <li key={line} className="flex items-start gap-2.5 text-body-regular text-text-primary">
            <RiCheckLine className="mt-0.5 size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col gap-1.5">
        <span className="text-body-medium text-text-secondary">Workspace it may use</span>
        {workspaces.length > 1 ? (
          <Select aria-label="Workspace" selectedKey={workspaceId} onSelectionChange={(k) => setWorkspaceId(String(k))} className="w-full" triggerClassName="w-full" popoverClassName="w-[var(--trigger-width)]">
            {workspaces.map((w) => (
              <SelectItem key={w.id} id={w.id} textValue={w.name}>
                {w.name}
              </SelectItem>
            ))}
          </Select>
        ) : (
          <div className="flex h-9 items-center rounded-2lg bg-background-tertiary-default px-2.5 text-body-regular text-text-primary">{workspaces[0]?.name}</div>
        )}
        <p className="text-caption-1-regular text-text-tertiary">Runs started from {title} use this workspace&apos;s credits and show up in its Enrich tab. Nothing is spent unless you ask for it in the chat.</p>
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        <form action={approve}>
          <input type="hidden" name="authorization_id" value={authorizationId} />
          <input type="hidden" name="workspace_id" value={workspaceId} />
          <input type="hidden" name="client_id" value={client.id} />
          <input type="hidden" name="client_name" value={client.name} />
          <Button type="submit" className="w-full" disabled={busy} aria-busy={approving}>
            {approving ? "Connecting…" : `Allow ${title} to use Preb`}
          </Button>
        </form>
        <form action={deny}>
          <input type="hidden" name="authorization_id" value={authorizationId} />
          <Button type="submit" variant="secondary" className="w-full" disabled={busy} aria-busy={denying}>
            Cancel
          </Button>
        </form>
      </div>

      <p className="mt-6 text-caption-1-regular text-text-secondary">
        {client.redirectHost ? (
          <>
            After approving you return to <span className="text-caption-1-medium text-text-primary" dir="ltr">{client.redirectHost}</span>.{" "}
          </>
        ) : null}
        You can disconnect any time under Integrations in Preb.
      </p>
    </div>
  );
}
