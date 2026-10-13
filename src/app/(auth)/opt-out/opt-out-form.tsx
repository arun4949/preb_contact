"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { RiMailCheckLine } from "@remixicon/react";
import { Banner } from "@/components/base/banner/banner";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Textarea } from "@/components/base/textarea/textarea";
import { PhoneField } from "@/components/application/phone-field/phone-field";
import { Turnstile, type TurnstileHandle } from "@/components/application/turnstile/turnstile";
import { requestOptOut, type OptOutFormState } from "@/lib/opt-out/actions";
import { NOTE_MAX_LENGTH } from "@/lib/opt-out/validate";
import { MARKETING_SITE_URL } from "@/lib/site-links";
import { cx } from "@/utils/cx";

const EXPLAINER_URL = `${MARKETING_SITE_URL}/contact-opt-out`;

const link = "underline-offset-2 hover:text-text-primary hover:underline";

export function OptOutForm({ siteKey, defaultCountry }: { siteKey: string; defaultCountry: string }) {
  const [state, action, pending] = useActionState<OptOutFormState, FormData>(requestOptOut, { status: "idle" });
  const [phoneValid, setPhoneValid] = useState(true);
  const [widgetFailed, setWidgetFailed] = useState(false);
  const turnstile = useRef<TurnstileHandle>(null);

  const fieldError = (field: OptOutFormState["field"]) => (state.status === "error" && state.field === field ? state.message : undefined);
  const bannerError = state.status === "error" && !state.field ? state.message : state.status === "error" && state.field === "turnstile" ? state.message : null;

  // Turnstile tokens are single use: a failed submit needs a fresh one.
  useEffect(() => {
    if (state.status === "error") turnstile.current?.reset();
  }, [state]);

  const guardSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (phoneValid) return;
    event.preventDefault();
    (event.currentTarget.elements.namedItem("phone") as HTMLInputElement | null)?.focus();
  };

  const card = "flex w-full max-w-[440px] flex-col rounded-3xl border border-border-button-default bg-background-primary-default p-6 shadow-xs sm:p-8";

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
          We sent a confirmation link to{" "}
          <span className="text-body-medium text-text-primary" dir="ltr">
            {state.email}
          </span>
          . It works once and stays valid for 24 hours. Nothing changes until you confirm.
        </p>
        <p className="mt-4 text-body-regular text-text-secondary">If it does not arrive within a few minutes, check your spam folder or send the form again.</p>
      </div>
    );
  }

  return (
    <div className={card}>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title-2-medium text-text-primary">Ask Preb not to process your data</h1>
        <p className="text-body-regular text-text-secondary">
          Enter the email address a recruiter may have used to find you. We send you a link to confirm it is yours. Once you confirm, Preb deletes the results
          stored about that address and never looks it up again.{" "}
          <a href={EXPLAINER_URL} target="_blank" rel="noopener noreferrer" className={cx(link, "text-text-primary underline")}>
            How this works
          </a>
          .
        </p>
      </div>

      {bannerError ? (
        <Banner tone="error" className="mt-5">
          {bannerError}
        </Banner>
      ) : widgetFailed ? (
        <Banner tone="warning" className="mt-5">
          The security check could not load. Please reload the page and try again.
        </Banner>
      ) : null}

      <form action={action} onSubmit={guardSubmit} className="mt-6 flex flex-col gap-4">
        <Input
          name="email"
          type="email"
          label="Email address"
          placeholder="you@example.com"
          defaultValue={state.status === "error" ? state.email : undefined}
          autoComplete="email"
          inputDir="ltr"
          isRequired
          isInvalid={Boolean(fieldError("email"))}
          hint={fieldError("email")}
        />
        <PhoneField
          label="Phone number"
          placeholder="Optional"
          hint="Add it if a recruiter reached you by phone."
          defaultCountry={defaultCountry}
          errorMessage={fieldError("phone") ?? null}
          onValidityChange={setPhoneValid}
        />
        <Input
          name="linkedin"
          type="url"
          label="LinkedIn profile URL"
          placeholder="Optional, e.g. linkedin.com/in/your-handle"
          autoComplete="url"
          inputDir="ltr"
          isInvalid={Boolean(fieldError("linkedin"))}
          hint={fieldError("linkedin")}
        />
        <Textarea
          name="note"
          label="Anything we should know?"
          placeholder="Optional, for example which company contacted you."
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          isInvalid={Boolean(fieldError("note"))}
          hint={fieldError("note")}
        />
        {/* Honeypot: hidden from people and assistive tech, filled by bots. */}
        <div aria-hidden className="absolute -start-[9999px] size-px overflow-hidden opacity-0">
          <label>
            Fax <input type="text" name="fax" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        {siteKey ? <Turnstile ref={turnstile} siteKey={siteKey} onError={() => setWidgetFailed(true)} /> : null}
        <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
          {pending ? "Sending link…" : "Send me a confirmation link"}
        </Button>
      </form>

      <p className="mt-6 text-caption-1-regular text-text-secondary">
        By sending this request you confirm that these contact details are yours. Phone numbers and LinkedIn profiles are checked by our team before they are
        added. Read more on{" "}
        <a href={EXPLAINER_URL} target="_blank" rel="noopener noreferrer" className={link}>
          Your data and Preb
        </a>
        .
      </p>
    </div>
  );
}
