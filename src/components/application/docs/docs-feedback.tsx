"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { RiThumbDownLine, RiThumbUpLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { useSupportChat } from "@/components/foundations/featurebase/featurebase";
import { submitDocsFeedback } from "@/lib/docs/feedback";

type Vote = "yes" | "no";
const KEY = (slug: string) => `preb:docs-feedback:${slug}`;

function readVote(slug: string): Vote | null {
  try {
    const v = localStorage.getItem(KEY(slug));
    return v === "yes" || v === "no" ? v : null;
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

/**
 * "Was this helpful?" at the end of every article. One vote per browser and
 * article (localStorage), counts only on the server. The server HTML always
 * shows the question; the client flips to the thank-you when a vote exists.
 */
export function DocsFeedback({ slug }: { slug: string }) {
  const stored = useSyncExternalStore(subscribe, () => readVote(slug), () => null);
  const [local, setLocal] = useState<Vote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const chat = useSupportChat();
  const vote = local ?? stored;

  const cast = (v: Vote) => {
    setError(null);
    start(async () => {
      const result = await submitDocsFeedback(slug, v === "yes");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      try {
        localStorage.setItem(KEY(slug), v);
      } catch {
        /* private mode: the vote still counted */
      }
      setLocal(v);
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-button-default bg-background-primary-default px-5 py-4" aria-live="polite">
      {vote ? (
        <>
          <span className="text-body-medium text-text-primary">Thanks for your feedback.</span>
          {vote === "no" ? (
            <LinkButton size="small" onClick={() => chat.showNewMessage()}>
              Tell us what was missing
            </LinkButton>
          ) : null}
        </>
      ) : (
        <>
          <span className="flex flex-col gap-0.5">
            <span className="text-body-medium text-text-primary">Was this article helpful?</span>
            {error ? <span className="text-body-2-regular text-text-error-primary">{error}</span> : null}
          </span>
          <span className="flex items-center gap-2">
            <Button variant="secondary" size="small" leadingIcon={RiThumbUpLine} onClick={() => cast("yes")} disabled={pending}>
              Yes
            </Button>
            <Button variant="secondary" size="small" leadingIcon={RiThumbDownLine} onClick={() => cast("no")} disabled={pending}>
              No
            </Button>
          </span>
        </>
      )}
    </div>
  );
}
