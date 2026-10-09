import "server-only";

import { SignJWT } from "jose";
import { getPlan } from "@/lib/credits/plans";
import type { SessionContext } from "@/lib/supabase/queries";

/** Identity tokens are minted per page render; a day covers a long-lived tab. */
const TOKEN_TTL = "24h";

let missingSecretLogged = false;

/** Monthly list price in USD for the workspace's plan (annual plans spread over 12 months), 0 on trial. */
function monthlySpend(planKey: string | null): number {
  const plan = getPlan(planKey);
  if (!plan) return 0;
  const monthly = plan.interval === "year" ? plan.priceCents / 12 : plan.priceCents;
  return Math.round(monthly) / 100;
}

/**
 * Server-signed Featurebase identity (HS256, secret from Settings → Access &
 * Security → Security). The signed-in app shell passes it to the messenger so
 * a support conversation shows who writes and the state of their workspace.
 * Every custom attribute below must exist in the Featurebase dashboard
 * (Settings → Users → Custom attributes) or Featurebase drops it silently.
 * Returns null when the secret is unset so the messenger stays anonymous.
 */
export async function signFeaturebaseJwt(session: SessionContext): Promise<string | null> {
  const secret = process.env.FEATUREBASE_JWT_SECRET;
  if (!secret) {
    if (!missingSecretLogged) {
      missingSecretLogged = true;
      console.warn("[featurebase] FEATUREBASE_JWT_SECRET is not set: the messenger runs anonymous only.");
    }
    return null;
  }

  const { profile, workspace } = session;
  const plan = getPlan(workspace.plan_key);

  const payload = {
    userId: session.userId,
    email: session.email,
    name: profile.full_name ?? session.email,
    ...(profile.avatar_url ? { profilePicture: profile.avatar_url } : {}),
    createdAt: profile.created_at,
    // User attributes (dashboard: Users → Custom attributes).
    role: session.role,
    workspaceId: workspace.id,
    companies: [
      {
        id: workspace.id,
        name: workspace.name,
        createdAt: workspace.created_at,
        monthlySpend: monthlySpend(workspace.plan_key),
        // Company attributes (dashboard: Companies → Custom attributes).
        planName: plan?.name ?? "Trial",
        planKey: workspace.plan_key ?? "trial",
        creditsAvailable: session.creditsAvailable,
        isTrial: !workspace.plan_key,
        subscriptionStatus: workspace.subscription_status ?? "none",
        currentPeriodEnd: workspace.current_period_end ?? "",
      },
    ],
  };

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(new TextEncoder().encode(secret));
}
