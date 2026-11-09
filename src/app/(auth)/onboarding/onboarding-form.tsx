"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { Banner } from "@/components/base/banner/banner";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { PhoneField } from "@/components/application/phone-field/phone-field";
import { completeOnboarding, type OnboardingState } from "./actions";
import { META_FLUSH_DELAY_MS, newMetaEventId, trackMetaEvent } from "@/lib/meta/client";

export type OnboardingMode = "first_login" | "no_workspace";

const COPY: Record<OnboardingMode, { title: string; intro: string }> = {
  first_login: {
    title: "Welcome to Preb",
    intro: "Tell us who you are and name your workspace. You can invite teammates later.",
  },
  no_workspace: {
    title: "Create a workspace",
    intro: "You are no longer a member of a workspace. Create your own to keep using Preb, or ask a teammate for a new invite.",
  },
};

export interface OnboardingFormProps {
  mode: OnboardingMode;
  defaultName: string;
  defaultWorkspace: string;
  /** Stored E.164 number when the user already gave one (no_workspace mode). */
  defaultPhone: string | null;
  /** ISO 3166-1 alpha-2 for the country selector (geo header or stored). */
  defaultCountry: string;
}

export function OnboardingForm({ mode, defaultName, defaultWorkspace, defaultPhone, defaultCountry }: OnboardingFormProps) {
  const [phoneValid, setPhoneValid] = useState(true);
  // One id per form instance, shared by the browser pixel and the server event (deduplication).
  const [metaEventId] = useState(newMetaEventId);
  const metaTracked = useRef(false);
  // Guards the one-time navigation (Strict Mode re-runs effects in dev).
  const navigated = useRef(false);

  // Meta Ads: browser half of the signup conversion; the action sent the server half
  // with the same id. Fired here, as soon as the action succeeds, and not in the effect
  // below: the action deletes a cookie, so Next refreshes /onboarding, whose redirect to
  // /lists can unmount this form before any effect runs (lost on prod, 2026-11-09).
  const submit = async (previous: OnboardingState, formData: FormData): Promise<OnboardingState> => {
    const next = await completeOnboarding(previous, formData);
    if (next.status === "done" && mode === "first_login" && !metaTracked.current) {
      metaTracked.current = trackMetaEvent("CompleteRegistration", {}, metaEventId);
    }
    return next;
  };
  const [state, action, pending] = useActionState<OnboardingState, FormData>(submit, { status: "idle" });
  const copy = COPY[mode];
  const done = state.status === "done";
  const phoneError = state.status === "error" && state.field === "phone" ? state.message : null;

  // The field validates inline; a form-level guard keeps an invalid number
  // from reaching the action (useActionState submits through `action`).
  const guardSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (phoneValid) return;
    event.preventDefault();
    (event.currentTarget.elements.namedItem("phone") as HTMLInputElement | null)?.focus();
  };

  // Full navigation (not router.push): the app shell is a different layout
  // group and must render from a fresh tree with the new workspace.
  useEffect(() => {
    if (!done || navigated.current) return;
    navigated.current = true;
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional hard navigation, see actions.ts
    const go = () => window.location.assign("/lists");
    // The pixel sends asynchronously and a full navigation cancels a pending request,
    // so give it a moment when the conversion was just fired. No timer cleanup on
    // purpose: the navigation must happen even if the effect re-runs.
    if (metaTracked.current) window.setTimeout(go, META_FLUSH_DELAY_MS);
    else go();
  }, [done]);

  return (
    <div className="flex w-full max-w-[440px] flex-col rounded-3xl border border-border-button-default bg-background-primary-default p-6 shadow-xs sm:p-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title-2-medium text-text-primary">{copy.title}</h1>
        <p className="text-body-regular text-text-secondary">{copy.intro}</p>
      </div>

      {state.status === "error" && !phoneError ? (
        <Banner tone="error" className="mt-5">
          {state.message}
        </Banner>
      ) : null}

      <form action={action} onSubmit={guardSubmit} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="meta_event_id" value={metaEventId} />
        <Input name="full_name" label="Full name" placeholder="Ada Lovelace" defaultValue={defaultName} autoComplete="name" isRequired />
        <Input
          name="workspace_name"
          label="Workspace name"
          placeholder="Acme Recruiting"
          defaultValue={defaultWorkspace}
          hint="Usually your company or agency name."
          isRequired
        />
        <PhoneField
          label="Phone number"
          placeholder="Optional"
          hint="Get a direct line to our team for setup help and faster support. Never shown to your teammates."
          defaultValue={defaultPhone}
          defaultCountry={defaultCountry}
          errorMessage={phoneError}
          onValidityChange={setPhoneValid}
        />
        <Button type="submit" className="mt-2 w-full" disabled={pending || done} aria-busy={pending || done}>
          {pending || done ? "Creating workspace…" : "Create workspace"}
        </Button>
        <p className="text-body-2-regular text-text-tertiary">
          We send occasional product news. If you add your number, we may call you once to help you get started. You can turn both off anytime in your profile settings.
        </p>
      </form>
    </div>
  );
}
