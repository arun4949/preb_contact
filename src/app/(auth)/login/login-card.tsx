"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { RiMailCheckLine } from "@remixicon/react";
import { Banner } from "@/components/base/banner/banner";
import { Button } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { Divider } from "@/components/base/divider/divider";
import { Input } from "@/components/base/input/input";
import { InputOtp } from "@/components/base/input-otp/input-otp";
import { SocialButton } from "@/components/base/social-button/social-button";
import { sendMagicLink, signInWithGoogle, verifyEmailCode, type MagicLinkState } from "@/lib/auth/actions";
import { clearPrefillEmailCookie } from "@/lib/auth/prefill-email";
import { SIGN_IN_CODE_DEFAULT_LENGTH, signInCodeGroup } from "@/lib/auth/sign-in-code";
import { LEGAL_URLS } from "@/lib/site-links";
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

/** Non-error notices after a redirect, e.g. a completed account deletion. */
const NOTICES: Record<string, string> = {
  account_deleted: "Your account has been deleted. Thank you for trying Preb.",
};

export function LoginCard({ next, error, notice, prefillEmail }: { next: string; error?: string; notice?: string; prefillEmail?: string }) {
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(sendMagicLink, { status: "idle" });

  // The handoff from preb.co is single-use, so a later visit starts empty.
  useEffect(() => {
    if (prefillEmail) clearPrefillEmailCookie();
  }, [prefillEmail]);

  const card = "flex w-full max-w-[400px] flex-col rounded-3xl border border-border-button-default bg-background-primary-default p-6 shadow-lg sm:p-8";

  if (state.status === "sent" && state.email) {
    return <CheckInboxCard card={card} email={state.email} codeLength={state.codeLength ?? SIGN_IN_CODE_DEFAULT_LENGTH} next={next} resend={action} resending={pending} />;
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
      ) : notice && NOTICES[notice] ? (
        <Banner tone="success" className="mt-5">
          {NOTICES[notice]}
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
          defaultValue={state.status === "error" ? state.email : prefillEmail}
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
        By continuing you agree to our{" "}
        <a href={LEGAL_URLS.terms} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-text-primary hover:underline">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href={LEGAL_URLS.privacy} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-text-primary hover:underline">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}

/**
 * After the email went out: the code from the email (auto-submits when
 * complete, so a phone user never leaves this browser) and the resend link.
 */
function CheckInboxCard({ card, email, codeLength, next, resend, resending }: { card: string; email: string; codeLength: number; next: string; resend: (formData: FormData) => void; resending: boolean }) {
  const [code, setCode] = useState("");
  // A wrong code clears the boxes, so the next attempt starts fresh.
  const submit = async (previous: MagicLinkState, formData: FormData): Promise<MagicLinkState> => {
    const result = await verifyEmailCode(previous, formData);
    if (result.status !== "verified") setCode("");
    return result;
  };
  const [state, verify, verifying] = useActionState<MagicLinkState, FormData>(submit, { status: "sent", email, codeLength });
  const formRef = useRef<HTMLFormElement>(null);
  const navigated = useRef(false);
  const verified = state.status === "verified";
  const invalid = state.status === "sent" && Boolean(state.message);

  // Submit as soon as the sixth digit is in (typed, pasted or autofilled from the email).
  const onComplete = () => {
    if (verifying || verified) return;
    // Let React commit the controlled value before the form reads it.
    queueMicrotask(() => formRef.current?.requestSubmit());
  };

  // Full navigation, not router.push: `next` lives in another layout group (see verifyEmailCode).
  useEffect(() => {
    if (!verified || navigated.current) return;
    navigated.current = true;
    window.location.assign(state.next ?? "/lists");
  }, [verified, state.next]);

  return (
    <div className={cx(card, "animate-page-enter")}>
      <div className="mb-5 flex">
        <span className="flex size-12 items-center justify-center rounded-full bg-background-secondary-default">
          <RiMailCheckLine className="size-6 text-foreground-icon-primary" aria-hidden />
        </span>
      </div>
      <h1 className="text-title-2-medium text-text-primary">Check your inbox</h1>
      <p className="mt-1.5 text-body-regular text-text-secondary">
        We sent a sign-in link and a code with {codeLength} digits to <span className="text-body-medium text-text-primary" dir="ltr">{email}</span>.
        Enter the code here or click the link. Both expire in one hour.
      </p>

      <form ref={formRef} action={verify} className="mt-6 flex flex-col gap-3" aria-live="polite">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="code" value={code} />
        <InputOtp
          length={codeLength}
          groupEvery={signInCodeGroup(codeLength)}
          size={codeLength <= 6 ? "sm" : "xs"}
          value={code}
          onChange={setCode}
          onComplete={onComplete}
          isDisabled={verifying || verified}
          isInvalid={invalid}
          aria-label="Sign-in code from the email"
        />
        {verified ? (
          <p className="text-body-regular text-text-secondary">Signed in, taking you to Preb…</p>
        ) : verifying ? (
          <p className="text-body-regular text-text-secondary">Checking the code…</p>
        ) : invalid ? (
          <p className="text-body-regular text-text-error-primary">{state.message}</p>
        ) : null}
      </form>

      <form action={resend} className="mt-6">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <p className="text-body-regular text-text-secondary">
          Didn&apos;t get it?{" "}
          <LinkButton type="submit" disabled={resending || verifying || verified}>
            Send a new code
          </LinkButton>
        </p>
      </form>
    </div>
  );
}
