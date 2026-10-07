import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { finishedResult } from "./__fixtures__/records";
import { FULLENRICH_BASE_URL, getBulkEnrichment, ProviderError, startBulkEnrichment } from "./client";

/** MSW mock of the provider: happy path plus the three error shapes the engine branches on. */
const server = setupServer(
  http.post(`${FULLENRICH_BASE_URL}/contact/enrich/bulk`, async ({ request }) => {
    const body = (await request.json()) as { data: unknown[] };
    if (request.headers.get("authorization") !== "Bearer test-key") return HttpResponse.json({ error: "error.api.key" }, { status: 401 });
    if (body.data.length === 99) return HttpResponse.json({ error: "error.rate.limit", message: "Too many requests" }, { status: 429 });
    return HttpResponse.json({ enrichment_id: "enr-1" });
  }),
  http.get(`${FULLENRICH_BASE_URL}/contact/enrich/bulk/:id`, ({ params }) => {
    switch (params.id) {
      case "running":
        return HttpResponse.json({ error: "error.enrichment.in_progress" }, { status: 400 });
      case "broke":
        return HttpResponse.json({ ...finishedResult, status: "CREDITS_INSUFFICIENT", cost: { credits: 3 } }, { status: 402 });
      case "gone":
        return HttpResponse.json({ error: "error.enrichment.not_found" }, { status: 404 });
      default:
        return HttpResponse.json(finishedResult);
    }
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const payload = (n: number) => ({
  name: "t",
  webhook_url: "https://app.test/api/webhooks/fullenrich",
  data: Array.from({ length: n }, (_, i) => ({ linkedin_url: `https://linkedin.com/in/p${i}`, enrich_fields: ["contact.work_emails" as const], custom: { contact_id: `c${i}` } })),
});

describe("provider client", () => {
  it("submits a bulk batch and returns the enrichment id", async () => {
    await expect(startBulkEnrichment(payload(2))).resolves.toEqual({ enrichment_id: "enr-1" });
  });

  it("refuses empty and oversized batches locally", async () => {
    await expect(startBulkEnrichment(payload(0))).rejects.toThrow(/1–100/);
    await expect(startBulkEnrichment(payload(101))).rejects.toThrow(/1–100/);
  });

  it("flags 429 as rate limited", async () => {
    const err = await startBulkEnrichment(payload(99)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).isRateLimited).toBe(true);
    expect((err as ProviderError).code).toBe("error.rate.limit");
  });

  it("flags the in-progress 400 distinctly from other 400s", async () => {
    const err = await getBulkEnrichment("running").catch((e: unknown) => e);
    expect((err as ProviderError).isInProgress).toBe(true);
  });

  it("exposes partial data on 402", async () => {
    const err = (await getBulkEnrichment("broke").catch((e: unknown) => e)) as ProviderError;
    expect(err.isInsufficientCredits).toBe(true);
    expect((err.body as { status: string; data: unknown[] }).status).toBe("CREDITS_INSUFFICIENT");
    expect((err.body as { data: unknown[] }).data).toHaveLength(3);
  });

  it("flags 404", async () => {
    const err = (await getBulkEnrichment("gone").catch((e: unknown) => e)) as ProviderError;
    expect(err.isNotFound).toBe(true);
  });

  it("returns the finished payload", async () => {
    const res = await getBulkEnrichment("enr-1");
    expect(res.status).toBe("FINISHED");
    expect(res.cost?.credits).toBe(15);
  });
});
