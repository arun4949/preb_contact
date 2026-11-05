import { headers } from "next/headers";
import { ReferralHeader } from "@/components/application/referral/referral-header";
import { ReferralLanding, ReferralUnavailable } from "@/components/application/referral/referral-landing";
import { isThrottled, throttleKey } from "@/lib/opt-out/throttle";
import { clientIp } from "@/lib/opt-out/turnstile";
import { getReferralLanding } from "@/lib/referrals/queries";
import { getSessionContext } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

/** Best-effort per-instance throttle on the landing page (30 requests a minute per IP and browser). */
async function isLandingThrottled(): Promise<boolean> {
  const h = await headers();
  return isThrottled(throttleKey(clientIp(h), h.get("user-agent")), Date.now(), { windowMs: 60_000, max: 30 });
}

/**
 * /r/<code>: the page a friend lands on from an invite link. Shows who
 * invited them and the trial, then sends them through /r/<code>/go (cookie,
 * click count) to /login. A signed-in member of the inviting workspace sees
 * that it is their own link. Unknown, revoked and throttled requests all
 * render the same generic card.
 */
export default async function ReferralPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const landing = (await isLandingThrottled()) ? null : await getReferralLanding(code);
  if (!landing) {
    return (
      <>
        <ReferralHeader code={null} />
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
          <ReferralUnavailable />
        </main>
      </>
    );
  }
  const session = await getSessionContext();
  const isOwnLink = session?.workspace.id === landing.workspaceId;
  return (
    <>
      <ReferralHeader code={landing.code} />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <ReferralLanding landing={landing} isOwnLink={isOwnLink} />
      </main>
    </>
  );
}
