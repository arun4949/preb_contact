"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiLockLine } from "@remixicon/react";
import { InputOtp } from "@/components/base/input-otp/input-otp";
import { LEAD_CODE_LENGTH } from "@/lib/leads/constants";
import type { LeadOwnerView } from "@/lib/leads/owners";
import { submitLeadCode, type CodeResult } from "@/lib/leads/public-actions";
import { OwnerPortrait } from "./owner-portrait";

const minutesLeft = (until: string) => Math.max(1, Math.ceil((new Date(until).getTime() - Date.now()) / 60_000));

/**
 * The code gate: the 4 digits the founder sent in the chat. Five wrong codes
 * lock the link for 15 minutes; a correct one sets a 30-day cookie and the
 * page re-renders with the list.
 */
export function LeadGate({ token, owner, leadFirstName, locked }: { token: string; owner: LeadOwnerView; leadFirstName: string; locked: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<CodeResult | null>(locked ? { ok: false, reason: "locked", until: locked } : null);
  const [pending, start] = useTransition();
  const lockedUntil = result && !result.ok && result.reason === "locked" ? result.until : null;

  // Re-enable the gate when the lock runs out, without a reload.
  useEffect(() => {
    if (!lockedUntil) return;
    const ms = new Date(lockedUntil).getTime() - Date.now();
    const t = setTimeout(() => {
      setResult(null);
      setCode("");
    }, Math.max(1000, ms));
    return () => clearTimeout(t);
  }, [lockedUntil]);

  const submit = (value: string) => {
    if (pending || value.length !== LEAD_CODE_LENGTH) return;
    start(async () => {
      const res = await submitLeadCode(token, value);
      if (res.ok) {
        router.refresh();
        return;
      }
      setResult(res);
      setCode("");
    });
  };

  const invalid = result !== null && !result.ok && result.reason === "invalid";
  let message: string | null = null;
  if (result && !result.ok) {
    if (result.reason === "invalid") message = result.remaining === 1 ? "That code is not right. One more try before the link locks for a while." : `That code is not right. ${result.remaining} tries left.`;
    else if (result.reason === "locked") message = `Too many wrong codes. The link is locked for ${minutesLeft(result.until)} ${minutesLeft(result.until) === 1 ? "minute" : "minutes"}.`;
    else if (result.reason === "throttled") message = "Too many attempts from your connection. Please wait a few minutes.";
    else message = "This link is no longer available.";
  }

  return (
    <div className="w-full max-w-[440px] rounded-3xl border border-border-button-default bg-background-primary-default p-6 shadow-xs animate-page-enter sm:p-8">
      <div className="flex flex-col items-center gap-5 text-center">
        <OwnerPortrait owner={owner} size={72} />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-title-3-semibold text-text-primary">
            {owner.firstName} prepared an enriched list for {leadFirstName}
          </h1>
          <p className="text-body-regular text-text-secondary">Enter the {LEAD_CODE_LENGTH}-digit code from the message to open it.</p>
        </div>

        <div className="flex flex-col items-center gap-3" aria-live="polite">
          <InputOtp
            length={LEAD_CODE_LENGTH}
            value={code}
            onChange={(v) => {
              setCode(v);
              if (invalid) setResult(null);
            }}
            onComplete={submit}
            isDisabled={pending || lockedUntil !== null}
            isInvalid={invalid}
            aria-label="Access code"
          />
          {message ? (
            <p className={lockedUntil ? "flex items-center gap-1.5 text-body-2-regular text-text-secondary" : "text-body-2-regular text-text-error-primary"}>
              {lockedUntil ? <RiLockLine className="size-4 shrink-0" aria-hidden /> : null}
              {message}
            </p>
          ) : (
            <p className="text-body-2-regular text-text-tertiary">{pending ? "Checking…" : `The code was sent to you by ${owner.firstName}.`}</p>
          )}
        </div>
      </div>
    </div>
  );
}
