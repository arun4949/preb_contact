"use client";

import { useActionState } from "react";
import { Banner } from "@/components/base/banner/banner";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { completeOnboarding, type OnboardingState } from "./actions";

export function OnboardingForm({ defaultName, defaultWorkspace }: { defaultName: string; defaultWorkspace: string }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, { status: "idle" });

  return (
    <div className="flex w-full max-w-[440px] flex-col rounded-3xl border border-border-button-default bg-background-primary-default p-6 shadow-xs sm:p-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title-2-medium text-text-primary">Welcome to Preb</h1>
        <p className="text-body-regular text-text-secondary">
          Tell us who you are and name your workspace. You can invite teammates later.
        </p>
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
        <Button type="submit" className="mt-2 w-full" disabled={pending} aria-busy={pending}>
          {pending ? "Creating workspace…" : "Create workspace"}
        </Button>
      </form>
    </div>
  );
}
