"use client";

import { useActionState } from "react";
import { RiMailCheckLine } from "@remixicon/react";
import { Banner } from "@/components/base/banner/banner";
import { Button } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { Divider } from "@/components/base/divider/divider";
import { Input } from "@/components/base/input/input";
import { SocialButton } from "@/components/base/social-button/social-button";
import { sendMagicLink, signInWithGoogle, type MagicLinkState } from "@/lib/auth/actions";
import { cx } from "@/utils/cx";

/**
 * Sign-in card: Google + email magic link, no passwords. A trimmed fork of
 * BoardUI's AuthCard (`mode="signin"` without the password / remember-me
 * rows, plus a "check your inbox" state after the link is sent).
 */
const ERRORS: Record<string, string> = {
  oauth: "Google sign-in didn't complete. Please try again.",
  callback: "We couldn't finish signing you in. Please try again.",
  link: "That sign-in link is invalid or has expired. Request a new one below.",
  work_email: "Please sign in with your work email. Personal and disposable mailboxes can't start a Preb workspace.",
};

export function LoginCard({ next, error }: { next: string; error?: string }) {
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(sendMagicLink, { status: "idle" });

  const card = "flex w-full max-w-[400px] flex-col rounded-3xl border border-border-button-default bg-background-primary-default p-6 shadow-xs sm:p-8";

  if (state.status === "sent") {
    return (
      <div className={cx(card, "animate-page-enter")}>
        <div className="mb-5 flex">
          <span className="flex size-12 items-center justify-center rounded-full bg-background-secondary-default">
            <RiMailCheckLine className="size-6 text-foreground-icon-primary" aria-hidden />
          </span>
        </div>
        <h1 className="text-title-2-medium text-text-primary">Check your inbox</h1>
        <p className="mt-1.5 text-body-regular text-text-secondary">
          We sent a sign-in link to <span className="text-body-medium text-text-primary" dir="ltr">{state.email}</span>. It expires in one
          hour.
        </p>
        <form action={action} className="mt-6">
          <input type="hidden" name="email" value={state.email} />
          <input type="hidden" name="next" value={next} />
          <p className="text-body-regular text-text-secondary">
            Didn&apos;t get it?{" "}
            <LinkButton type="submit" disabled={pending}>
              Send a new link
            </LinkButton>
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className={card}>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title-2-medium text-text-primary">Sign in to Preb</h1>
        <p className="text-body-regular text-text-secondary">Find verified emails and phone numbers for your candidate lists.</p>
      </div>

      {error && ERRORS[error] ? (
        <Banner tone="error" className="mt-5">
          {ERRORS[error]}
        </Banner>
      ) : null}

      <form action={signInWithGoogle} className="mt-6">
        <input type="hidden" name="next" value={next} />
        <SocialButton brand="google" appearance="white" fullWidth type="submit">
          Continue with Google
        </SocialButton>
      </form>

      <div className="my-5">
        <Divider>or</Divider>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Input
          name="email"
          type="email"
          label="Work email"
          defaultValue={state.status === "error" ? state.email : undefined}
          placeholder="you@company.com"
          autoComplete="email"
          inputDir="ltr"
          isRequired
          isInvalid={state.status === "error"}
          hint={state.status === "error" ? state.message : undefined}
        />
        <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
          {pending ? "Sending link…" : "Continue with email"}
        </Button>
      </form>

      <p className="mt-6 text-caption-1-regular text-text-secondary">
        By continuing you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}
