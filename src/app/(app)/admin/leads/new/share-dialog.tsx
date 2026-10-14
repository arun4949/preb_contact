"use client";

import { useState } from "react";
import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { Dialog } from "@/components/base/dialog/dialog";
import { useToast } from "@/components/base/toast/toast";

export interface CreatedShare {
  leadName: string;
  path: string;
  code: string;
  rows: number;
}

/** Builds the absolute share URL in the browser, so dev and prod both get the right origin. */
export function shareUrl(path: string) {
  return typeof window === "undefined" ? path : `${window.location.origin}${path}`;
}

/** The message founders paste into the LinkedIn or email thread. */
export function chatMessage(url: string, code: string) {
  return `Hey, just finished running these through for you: ${url}\nCode is ${code}, just to keep the candidate data private.`;
}

function CopyRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-body-2-medium text-text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        <code dir="ltr" className={mono ? "flex-1 rounded-xl border border-border-button-default bg-background-secondary-default px-3 py-2 font-mono text-title-3-medium tracking-[0.3em] text-text-primary" : "min-w-0 flex-1 truncate rounded-xl border border-border-button-default bg-background-secondary-default px-3 py-2 text-body-regular text-text-primary"}>
          {value}
        </code>
        <Button variant="secondary" size="small" leadingIcon={copied ? RiCheckLine : RiFileCopyLine} onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

/** After creation: the link, the code and a ready-to-paste chat message. */
export function ShareDialog({ created, onClose }: { created: CreatedShare | null; onClose: () => void }) {
  const url = created ? shareUrl(created.path) : "";
  return (
    <Dialog
      isOpen={created !== null}
      onOpenChange={(o) => !o && onClose()}
      title={created ? `Share with ${created.leadName}` : "Share"}
      description={created ? `${created.rows} ${created.rows === 1 ? "profile is" : "profiles are"} being enriched. Send the link and the code in the chat; the page shows results as they come in.` : undefined}
      size="md"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      {created ? (
        <div className="flex flex-col gap-5">
          <CopyRow label="Link" value={url} />
          <CopyRow label="Code" value={created.code} mono />
          <CopyRow label="Chat message" value={chatMessage(url, created.code)} />
        </div>
      ) : null}
    </Dialog>
  );
}
