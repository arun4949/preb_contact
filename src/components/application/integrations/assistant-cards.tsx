"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiExternalLinkLine, RiPlugLine } from "@remixicon/react";
import { Chip } from "@/components/base/badges/chip";
import { Button, ButtonLink } from "@/components/base/buttons/button";
import { ConfirmDialog } from "@/components/base/dialog/dialog";
import { useToast } from "@/components/base/toast/toast";
import { AssistantLogo } from "@/components/foundations/brand/assistant-logo";
import { ASSISTANTS, type AssistantId } from "@/lib/mcp/clients";
import { disconnectAssistant } from "@/lib/mcp/actions";
import type { AssistantConnection } from "@/lib/mcp/queries";
import { docsPath } from "@/lib/site-links";

const CARDS: { id: AssistantId; title: string; description: string }[] = [
  { id: "claude", title: "Claude", description: "Enrich people and check results without leaving your Claude chat." },
  { id: "chatgpt", title: "ChatGPT", description: "Ask ChatGPT for verified emails and mobile numbers, straight from the chat." },
  { id: "other", title: "Other assistants", description: "Claude Code, Cursor and any tool that supports MCP servers." },
];

const relative = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
};

export interface AssistantCardsProps {
  connections: AssistantConnection[];
  /** Only the button label differs: both modes open the assistant's help article in a new tab. */
  mode: "overview" | "detail";
}

/**
 * The app-store grid: one card per assistant. A card whose assistant is
 * connected shows the live state and a Disconnect action; otherwise the
 * Connect button leads to the setup page or the help article.
 */
export function AssistantCards({ connections, mode }: AssistantCardsProps) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<AssistantConnection | null>(null);

  const disconnect = () => {
    if (!confirm) return;
    const c = confirm;
    start(async () => {
      const res = await disconnectAssistant(c.clientId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setConfirm(null);
      toast.success(`${ASSISTANTS[c.assistant].name} disconnected`);
      router.refresh();
    });
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => {
          const mine = connections.filter((c) => c.assistant === card.id);
          const guide = docsPath("integrations", ASSISTANTS[card.id].guide);
          return (
            <div key={card.id} id={card.id} className="flex scroll-mt-24 flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-5">
              <div className="flex items-center gap-3">
                <AssistantLogo id={card.id} />
                <span className="text-headline-medium text-text-primary">{card.title}</span>
                {mine.length ? (
                  <Chip variant="caption" color="lime" className="ms-auto">
                    Connected
                  </Chip>
                ) : null}
              </div>
              <p className="text-body-2-regular text-text-secondary">{card.description}</p>
              {mine.length ? (
                <ul className="flex flex-col gap-2">
                  {mine.map((c) => (
                    <li key={c.clientId} className="flex items-center justify-between gap-3 rounded-xl bg-background-secondary-default px-3 py-2">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-body-2-medium text-text-primary">{c.workspaceName || "Workspace"}</span>
                        <span className="text-caption-1-regular text-text-tertiary">
                          {c.lastUsedAt ? `Last used ${relative(c.lastUsedAt)}` : "Not used yet"}
                          {c.toolCalls ? ` · ${c.toolCalls.toLocaleString("en-US")} ${c.toolCalls === 1 ? "request" : "requests"}` : ""}
                        </span>
                      </span>
                      <Button variant="secondary" size="xs" onClick={() => setConfirm(c)} disabled={pending}>
                        Disconnect
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-auto flex flex-wrap gap-2">
                {/* One click, one tab: the guide opens directly (like FullEnrich), no detour through the setup page. */}
                <ButtonLink href={guide} target="_blank" rel="noopener noreferrer" variant="secondary" size="small" trailingIcon={RiExternalLinkLine} className="flex-1">
                  {mode === "overview" ? (mine.length ? "Add another" : "Connect") : "Setup guide"}
                </ButtonLink>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        isOpen={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        icon={RiPlugLine}
        title={confirm ? `Disconnect ${ASSISTANTS[confirm.assistant].name}?` : ""}
        description={confirm ? `${ASSISTANTS[confirm.assistant].name} loses access to the workspace "${confirm.workspaceName}" right away. To use Preb there again, connect it once more from the assistant.` : undefined}
        confirmLabel="Disconnect"
        isPending={pending}
        onConfirm={disconnect}
      />
    </>
  );
}
