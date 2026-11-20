"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { OnboardingSteps } from "@/components/application/auth/onboarding-steps";
import { Banner } from "@/components/base/banner/banner";
import { Button } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import { SIGNUP_SOURCE_DETAIL_MAX, signupSourceOption } from "@/lib/onboarding/signup-source";
import { submitSignupSource, type SignupSourceState } from "./actions";

const EASE = [0.22, 1, 0.36, 1] as const;

export interface SourceFormProps {
  /** Option keys in the order this person sees them (shuffled on the server, stable per person). */
  order: string[];
}

export function SourceForm({ order }: SourceFormProps) {
  const titleId = useId();
  const reducedMotion = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);
  // Which button was pressed, so only that one shows the busy label.
  const [intent, setIntent] = useState<"answer" | "skip">("answer");
  const [state, action, pending] = useActionState<SignupSourceState, FormData>(submitSignupSource, { status: "idle" });
  const done = state.status === "done";
  const busy = pending || done;
  // Guards the one-time navigation (Strict Mode re-runs effects in dev).
  const navigated = useRef(false);

  // Full navigation (not router.push): the app shell is a different layout
  // group and must render from a fresh tree, as after the first step. The
  // target is the ATS question when it is still open, else the app.
  useEffect(() => {
    if (!done || navigated.current) return;
    navigated.current = true;
    window.location.assign(state.next ?? "/lists");
  }, [done, state.next]);

  const option = signupSourceOption(selected);

  return (
    <div className="flex w-full max-w-[440px] flex-col rounded-3xl border border-border-button-default bg-background-primary-default p-6 shadow-xs sm:p-8">
      <OnboardingSteps current={1} className="mb-6" />
      <div className="flex flex-col gap-1.5">
        <h1 id={titleId} className="text-title-2-medium text-text-primary">
          How did you first hear about Preb?
        </h1>
        <p className="text-body-regular text-text-secondary">Optional. It helps us know what is working.</p>
      </div>

      {state.status === "error" ? (
        <Banner tone="error" className="mt-5">
          {state.message}
        </Banner>
      ) : null}

      <form action={action} className="mt-6 flex flex-col">
        <input type="hidden" name="source" value={selected ?? ""} />
        {/* Same dropdown as the ATS step. The options keep the per-person shuffled order (Other and Not sure last). */}
        <Select
          aria-labelledby={titleId}
          placeholder="Select an option"
          selectedKey={selected}
          onSelectionChange={(key) => setSelected(key === null ? null : String(key))}
          isDisabled={busy}
          className="w-full"
          // The placeholder reads as a prompt, not as a chosen value.
          triggerClassName="w-full [&>[data-placeholder]]:text-text-placeholder"
          popoverClassName="w-[var(--trigger-width)]"
          // Six and a half rows: the list opens below the field on a laptop screen instead of
          // flipping over the question, and the cut row shows that there is more to scroll.
          listClassName="max-h-[258px]"
          scrollFade
        >
          {order.map((key) => {
            const label = signupSourceOption(key)?.label ?? key;
            return (
              <SelectItem key={key} id={key} textValue={label}>
                {label}
              </SelectItem>
            );
          })}
        </Select>

        <AnimatePresence initial={false} mode="wait">
          {option?.detailLabel ? (
            <motion.div
              key={option.key}
              initial={reducedMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.22, ease: EASE }}
              // Clipped while the height animates; the padding leaves room for the focus ring.
              className="-mx-1 overflow-hidden px-1"
            >
              <div className="pt-5 pb-1">
                <Input name="detail" label={option.detailLabel} placeholder={option.detailPlaceholder ?? "Optional"} hint="Optional" maxLength={SIGNUP_SOURCE_DETAIL_MAX} autoComplete="off" />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="mt-6 flex flex-col items-center gap-4">
          <Button
            type="submit"
            name="intent"
            value="answer"
            className="w-full"
            disabled={busy || !selected}
            aria-busy={busy && intent === "answer"}
            onClick={() => setIntent("answer")}
          >
            {busy && intent === "answer" ? "Saving…" : "Continue"}
          </Button>
          <LinkButton type="submit" name="intent" value="skip" variant="secondary" disabled={busy} onClick={() => setIntent("skip")}>
            {busy && intent === "skip" ? "Skipping…" : "Skip for now"}
          </LinkButton>
        </div>
      </form>
    </div>
  );
}
