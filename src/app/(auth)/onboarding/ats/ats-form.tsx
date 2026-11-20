"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { OnboardingSteps } from "@/components/application/auth/onboarding-steps";
import { Banner } from "@/components/base/banner/banner";
import { Button } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import { SIGNUP_ATS_DETAIL_MAX, SIGNUP_ATS_OPTIONS, signupAtsOption } from "@/lib/onboarding/signup-ats";
import { ONBOARDING_DONE_PATH } from "@/lib/onboarding/steps";
import { submitSignupAts, type SignupAtsState } from "./actions";

const EASE = [0.22, 1, 0.36, 1] as const;

export function AtsForm() {
  const titleId = useId();
  const reducedMotion = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);
  // Which button was pressed, so only that one shows the busy label.
  const [intent, setIntent] = useState<"answer" | "skip">("answer");
  const [state, action, pending] = useActionState<SignupAtsState, FormData>(submitSignupAts, { status: "idle" });
  const done = state.status === "done";
  const busy = pending || done;
  // Guards the one-time navigation (Strict Mode re-runs effects in dev).
  const navigated = useRef(false);

  // Full navigation (not router.push): the app shell is a different layout
  // group and must render from a fresh tree, as after the first step.
  useEffect(() => {
    if (!done || navigated.current) return;
    navigated.current = true;
    window.location.assign(ONBOARDING_DONE_PATH);
  }, [done]);

  const option = signupAtsOption(selected);

  return (
    <div className="flex w-full max-w-[440px] flex-col rounded-3xl border border-border-button-default bg-background-primary-default p-6 shadow-xs sm:p-8">
      <OnboardingSteps current={2} className="mb-6" />
      <div className="flex flex-col gap-1.5">
        <h1 id={titleId} className="text-title-2-medium text-text-primary">
          Which ATS do you use?
        </h1>
        <p className="text-body-regular text-text-secondary">Optional. It helps us shape Preb around the tools you use.</p>
      </div>

      {state.status === "error" ? (
        <Banner tone="error" className="mt-5">
          {state.message}
        </Banner>
      ) : null}

      <form action={action} className="mt-6 flex flex-col">
        <input type="hidden" name="ats" value={selected ?? ""} />
        <Select
          aria-labelledby={titleId}
          placeholder="Select your ATS"
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
          {SIGNUP_ATS_OPTIONS.map((item) => (
            <SelectItem key={item.key} id={item.key} textValue={item.label}>
              {item.label}
            </SelectItem>
          ))}
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
                <Input name="detail" label={option.detailLabel} placeholder={option.detailPlaceholder ?? "Optional"} hint="Optional" maxLength={SIGNUP_ATS_DETAIL_MAX} autoComplete="off" />
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
