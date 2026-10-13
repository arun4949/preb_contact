"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { appOrigin } from "@/lib/auth/actions";
import { isRateLimited, sendEmail } from "@/lib/email/resend";
import { OptOutDoneEmail } from "@/lib/email/templates/opt-out-done";
import { OptOutVerifyEmail } from "@/lib/email/templates/opt-out-verify";
import { appUrl } from "@/lib/email/templates/layout";
import { notifyOps } from "@/lib/jobs/notify";
import { log, logError } from "@/lib/jobs/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { suppressIdentifier } from "@/lib/suppression/apply";
import { identifierHash, maskIdentifier, normaliseIdentifier } from "@/lib/suppression/identifiers";
import { isThrottled, throttleKey } from "./throttle";
import { createOptOutToken, hashOptOutToken, looksLikeOptOutToken, OPT_OUT_TOKEN_TTL_HOURS } from "./token";
import { clientIp, verifyTurnstile } from "./turnstile";
import { parseOptOutForm, type OptOutField } from "./validate";

/**
 * Public, unauthenticated actions behind /opt-out (privacy policy § 12). A
 * request is only acted on after the person opened the confirmation link, so
 * the form itself never reveals whether an address is already suppressed.
 */
export interface OptOutFormState {
  status: "idle" | "sent" | "error";
  email?: string;
  message?: string;
  field?: OptOutField | "turnstile";
}

const SEND_FAILED = "We could not send the confirmation link right now. Please try again in a moment.";

export async function requestOptOut(_prev: OptOutFormState, formData: FormData): Promise<OptOutFormState> {
  const parsed = parseOptOutForm(formData);
  if (!parsed.ok) return { status: "error", field: parsed.field, message: parsed.message };
  const { email, phone, linkedin, note, honeypot } = parsed.data;

  // Bots that fill the hidden field see the normal success state and nothing happens.
  if (honeypot) {
    log("opt_out.honeypot");
    return { status: "sent", email };
  }

  const h = await headers();
  const ip = clientIp(h);
  if (isThrottled(throttleKey(ip, h.get("user-agent")))) {
    return { status: "error", email, message: "Too many requests from your connection. Please try again in a few minutes." };
  }

  const turnstile = formData.get("cf-turnstile-response");
  if (!(await verifyTurnstile(typeof turnstile === "string" ? turnstile : null, ip))) {
    return { status: "error", email, field: "turnstile", message: "We could not confirm that you are a person. Please try again." };
  }

  if (await isRateLimited(email, "opt_out_verify")) {
    return { status: "error", email, message: "You already requested several links for this address. Please check your inbox, or try again in an hour." };
  }

  const admin = createAdminClient();
  const { token, tokenHash } = createOptOutToken();
  const { data: request, error } = await admin
    .from("opt_out_requests")
    .insert({
      email,
      email_hash: identifierHash("email", email),
      email_hint: maskIdentifier("email", email),
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + OPT_OUT_TOKEN_TTL_HOURS * 3_600_000).toISOString(),
      note,
    })
    .select("id")
    .single();
  if (error || !request) {
    logError("opt_out.insert_failed", error);
    return { status: "error", email, message: SEND_FAILED };
  }

  const identifiers = [
    phone ? { kind: "phone" as const, value: normaliseIdentifier("phone", phone) } : null,
    linkedin ? { kind: "linkedin" as const, value: linkedin } : null,
  ].filter((i): i is { kind: "phone" | "linkedin"; value: string } => Boolean(i?.value));
  if (identifiers.length) {
    const { error: idError } = await admin.from("opt_out_identifiers").insert(
      identifiers.map((i) => ({ request_id: request.id, kind: i.kind, value: i.value, value_hash: identifierHash(i.kind, i.value), value_hint: maskIdentifier(i.kind, i.value) })),
    );
    if (idError) logError("opt_out.identifiers_insert_failed", idError, { requestId: request.id });
  }

  try {
    const url = `${await appOrigin()}/opt-out/${token}`;
    await sendEmail({ to: email, subject: "Confirm your request to Preb", kind: "opt_out_verify", react: OptOutVerifyEmail({ url }) });
  } catch (sendError) {
    logError("opt_out.send_failed", sendError, { requestId: request.id });
    await admin.from("opt_out_requests").delete().eq("id", request.id);
    return { status: "error", email, message: SEND_FAILED };
  }

  log("opt_out.requested", { requestId: request.id, identifiers: identifiers.length });
  return { status: "sent", email };
}

/**
 * Confirmation is a POST from the button on /opt-out/[token], never a GET
 * side effect, so a mail scanner that prefetches the link cannot use it up.
 */
export async function confirmOptOut(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!looksLikeOptOutToken(token)) redirect("/opt-out");
  const admin = createAdminClient();

  // Atomic claim: a double click or a second tab finds nothing to update.
  const { data: claimed } = await admin
    .from("opt_out_requests")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("token_hash", hashOptOutToken(token))
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("id, email, email_hint, note")
    .maybeSingle();
  if (!claimed?.email) redirect(`/opt-out/${token}`);

  let cleared = 0;
  try {
    ({ cleared } = await suppressIdentifier(admin, "email", claimed.email, { source: "opt_out", requestId: claimed.id }));
  } catch (error) {
    // The list entry may exist while the clearing scan failed: the daily
    // reconciliation is manual (ops email below), the person is still blocked.
    logError("opt_out.suppress_failed", error, { requestId: claimed.id });
  }

  const { count } = await admin.from("opt_out_identifiers").select("id", { count: "exact", head: true }).eq("request_id", claimed.id).eq("status", "pending");
  const pendingReview = count ?? 0;

  try {
    await sendEmail({ to: claimed.email, subject: "Your request to Preb is confirmed", kind: "opt_out_done", react: OptOutDoneEmail({ hint: claimed.email_hint, pendingReview }) });
  } catch (error) {
    logError("opt_out.done_send_failed", error, { requestId: claimed.id });
  }

  // The raw address has done its job; only hash, hint and outcome stay (record of the request).
  await admin.from("opt_out_requests").update({ email: null, cleared_rows: cleared }).eq("id", claimed.id);
  log("opt_out.confirmed", { requestId: claimed.id, cleared, pendingReview });

  await notifyOps(pendingReview > 0 ? "Opt-out request needs review" : "Opt-out request confirmed", [
    `email: ${claimed.email_hint}`,
    `cleared rows: ${cleared}`,
    `awaiting review: ${pendingReview} phone or LinkedIn identifier(s)`,
    `note: ${claimed.note ?? "none"}`,
    appUrl("/admin/suppressions"),
  ]);

  redirect(`/opt-out/${token}?done=1`);
}
