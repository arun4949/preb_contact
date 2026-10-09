"use client";

import { useActionState, useEffect } from "react";
import { Banner } from "@/components/base/banner/banner";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { completeOnboarding, type OnboardingState } from "./actions";

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

export function OnboardingForm({ mode, defaultName, defaultWorkspace }: { mode: OnboardingMode; defaultName: string; defaultWorkspace: string }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, { status: "idle" });
  const copy = COPY[mode];
  const done = state.status === "done";

  // Full navigation (not router.push): the app shell is a different layout
  // group and must render from a fresh tree with the new workspace.
  useEffect(() => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional hard navigation, see actions.ts
    if (done) window.location.assign("/lists");
  }, [done]);

  return (
    <div className="flex w-full max-w-[440px] flex-col rounded-3xl border border-border-button-default bg-background-primary-default p-6 shadow-xs sm:p-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title-2-medium text-text-primary">{copy.title}</h1>
        <p className="text-body-regular text-text-secondary">{copy.intro}</p>
      </div>

      {state.status === "error" ? (
        <Banner tone="error" className="mt-5">
          {state.message}
        </Banner>
      ) : null}

      <form action={action} className="mt-6 flex flex-col gap-4">
        <Input name="full_name" label="Full name" placeholder="Ada Lovelace" defaultValue={defaultName} autoComplete="name" isRequired />
        <Input
          name="workspace_name"
          label="Workspace name"
          placeholder="Acme Recruiting"
          defaultValue={defaultWorkspace}
          hint="Usually your company or agency name."
          isRequired
        />
        <Button type="submit" className="mt-2 w-full" disabled={pending || done} aria-busy={pending || done}>
          {pending || done ? "Creating workspace…" : "Create workspace"}
        </Button>
        <p className="text-body-2-regular text-text-tertiary">We send occasional product news. You can turn it off anytime in your profile settings.</p>
      </form>
    </div>
  );
}
