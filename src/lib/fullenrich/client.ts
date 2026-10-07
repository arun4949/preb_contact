import "server-only";

import type {
  ApiErrorBody,
  BulkEnrichRequest,
  EnrichmentResult,
  ReverseEmailRequest,
} from "./types";

/**
 * Thin FullEnrich API v2 client. One small layer so the provider can be
 * swapped later. Rate limiting (60/min across all endpoints) is budgeted by
 * the dispatcher via `provider_rate_limit`; this client only reports 429s.
 */

export const FULLENRICH_BASE_URL = "https://app.fullenrich.com/api/v2";

export class ProviderError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    public readonly body: unknown,
  ) {
    super(`Enrichment provider error ${status}${code ? ` (${code})` : ""}`);
    this.name = "ProviderError";
  }

  get isInProgress() {
    return this.status === 400 && this.code === "error.enrichment.in_progress";
  }
  get isRateLimited() {
    return this.status === 429;
  }
  get isInsufficientCredits() {
    return this.status === 402;
  }
  get isNotFound() {
    return this.status === 404;
  }
}

function apiKey() {
  const key = process.env.FULLENRICH_API_KEY;
  if (!key) throw new Error("FULLENRICH_API_KEY is not set");
  return key;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${FULLENRICH_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const err = (body ?? {}) as ApiErrorBody;
    throw new ProviderError(response.status, typeof err.error === "string" ? err.error : undefined, body);
  }
  return body as T;
}

/** `GET /account/keys/verify` → workspace id. Used on boot / ops page. */
export async function verifyApiKey(): Promise<{ workspace_id: string }> {
  return request("/account/keys/verify");
}

/** `GET /account/credits` → our upstream balance. */
export async function getAccountCredits(): Promise<{ balance: number }> {
  return request("/account/credits");
}

/** `POST /contact/enrich/bulk?silentFail=true` → `{ enrichment_id }`. ≤100 contacts. */
export async function startBulkEnrichment(payload: BulkEnrichRequest): Promise<{ enrichment_id: string }> {
  if (payload.data.length === 0 || payload.data.length > 100) {
    throw new Error("Bulk enrichment accepts 1–100 contacts");
  }
  return request("/contact/enrich/bulk?silentFail=true", { method: "POST", body: JSON.stringify(payload) });
}

/**
 * `GET /contact/enrich/bulk/{id}`. Throws `ProviderError.isInProgress` while
 * running; 402 carries partial data in `body` (status CREDITS_INSUFFICIENT).
 */
export async function getBulkEnrichment(enrichmentId: string, forceResults = false): Promise<EnrichmentResult> {
  const query = forceResults ? "?forceResults=true" : "";
  return request(`/contact/enrich/bulk/${encodeURIComponent(enrichmentId)}${query}`);
}

/** `POST /contact/reverse/email/bulk?silentFail=true` (day 7). */
export async function startReverseEmailLookup(payload: ReverseEmailRequest): Promise<{ enrichment_id: string }> {
  if (payload.data.length === 0 || payload.data.length > 100) {
    throw new Error("Reverse lookup accepts 1–100 emails");
  }
  return request("/contact/reverse/email/bulk?silentFail=true", { method: "POST", body: JSON.stringify(payload) });
}

export async function getReverseEmailLookup(enrichmentId: string, forceResults = false): Promise<EnrichmentResult> {
  const query = forceResults ? "?forceResults=true" : "";
  return request(`/contact/reverse/email/bulk/${encodeURIComponent(enrichmentId)}${query}`);
}
