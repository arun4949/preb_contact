import { jwtVerify } from "jose";
import { afterEach, describe, expect, it } from "vitest";
import { signFeaturebaseJwt } from "./jwt";
import type { SessionContext } from "@/lib/supabase/queries";

const SECRET = "test-featurebase-secret";

function session(overrides: Partial<SessionContext["workspace"]> = {}): SessionContext {
  return {
    userId: "user-1",
    email: "jane@acme.com",
    role: "owner",
    creditsAvailable: 420,
    profile: {
      id: "user-1",
      email: "jane@acme.com",
      full_name: "Jane Doe",
      avatar_url: "https://img.test/jane.png",
      default_workspace_id: "ws-1",
      onboarded_at: null,
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z",
    },
    workspace: {
      id: "ws-1",
      name: "Acme",
      slug: "acme",
      owner_id: "user-1",
      stripe_customer_id: "cus_123",
      stripe_subscription_id: "sub_123",
      plan_key: "p2_1k_m",
      current_period_end: "2026-11-01T00:00:00.000Z",
      trial_granted_at: null,
      subscription_status: "active",
      cancel_at_period_end: false,
      low_credits_notified_at: null,
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z",
      ...overrides,
    } as SessionContext["workspace"],
  };
}

describe("signFeaturebaseJwt", () => {
  afterEach(() => {
    delete process.env.FEATUREBASE_JWT_SECRET;
  });

  it("returns null without a secret (messenger stays anonymous)", async () => {
    expect(await signFeaturebaseJwt(session())).toBeNull();
  });

  it("signs user identity and the workspace as a company with HS256", async () => {
    process.env.FEATUREBASE_JWT_SECRET = SECRET;
    const token = await signFeaturebaseJwt(session());
    expect(token).toBeTypeOf("string");
    const { payload, protectedHeader } = await jwtVerify(token!, new TextEncoder().encode(SECRET));
    expect(protectedHeader.alg).toBe("HS256");
    expect(payload).toMatchObject({
      userId: "user-1",
      email: "jane@acme.com",
      name: "Jane Doe",
      profilePicture: "https://img.test/jane.png",
      role: "owner",
      workspaceId: "ws-1",
    });
    expect(payload.exp! - payload.iat!).toBe(24 * 60 * 60);
    const [company] = payload.companies as Array<Record<string, unknown>>;
    expect(company).toMatchObject({
      id: "ws-1",
      name: "Acme",
      planKey: "p2_1k_m",
      planName: "Preb 1k",
      monthlySpend: 36.5,
      creditsAvailable: 420,
      isTrial: false,
      subscriptionStatus: "active",
      stripeCustomerId: "cus_123",
    });
  });

  it("describes a trial workspace and spreads annual prices per month", async () => {
    process.env.FEATUREBASE_JWT_SECRET = SECRET;
    const trial = await jwtVerify((await signFeaturebaseJwt(session({ plan_key: null, stripe_customer_id: null, subscription_status: null })))!, new TextEncoder().encode(SECRET));
    const [trialCompany] = trial.payload.companies as Array<Record<string, unknown>>;
    expect(trialCompany).toMatchObject({ isTrial: true, planName: "Trial", planKey: "trial", monthlySpend: 0, subscriptionStatus: "none", stripeCustomerId: "" });

    const annual = await jwtVerify((await signFeaturebaseJwt(session({ plan_key: "p2_12k_y" })))!, new TextEncoder().encode(SECRET));
    const [annualCompany] = annual.payload.companies as Array<Record<string, unknown>>;
    expect(annualCompany.monthlySpend).toBe(32.5);
  });
});
