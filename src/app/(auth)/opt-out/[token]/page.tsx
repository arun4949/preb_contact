import type { Metadata } from "next";
import { RiCheckboxCircleLine, RiLinkUnlinkM, RiTimeLine, RiUserForbidLine } from "@remixicon/react";
import { Button, ButtonLink } from "@/components/base/buttons/button";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { confirmOptOut } from "@/lib/opt-out/actions";
import { getOptOutRequestByToken } from "@/lib/opt-out/queries";
import { MARKETING_SITE_URL } from "@/lib/site-links";

export const metadata: Metadata = { title: "Confirm your request", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/**
 * Landing page of the confirmation link from the opt-out email. Confirmation
 * itself is a POST from the button, so link prefetching by mail scanners
 * cannot consume the single-use token.
 */
export default async function OptOutConfirmPage({ params, searchParams }: PageProps<"/opt-out/[token]">) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const view = await getOptOutRequestByToken(token);
  const justDone = view.outcome === "used" && query.done === "1";
  const hint = view.hint ? (
    <span className="text-body-medium text-text-primary" dir="ltr">
      {view.hint}
    </span>
  ) : null;
  const reviewNote = view.pendingReview > 0 ? " The phone number or LinkedIn profile you added is checked by our team before it is added." : "";

  const card = "w-full max-w-[480px] rounded-3xl border border-border-button-default bg-background-primary-default shadow-xs";

  if (justDone) {
    return (
      <div className={card}>
        <EmptyState
          icon={RiCheckboxCircleLine}
          title="Your request is confirmed"
          description={
            <>
              {hint} is now on our suppression list. We removed the results stored about it and will not look it up again for any customer. A confirmation is on
              its way to your inbox.{reviewNote}
            </>
          }
          actions={
            <ButtonLink href={MARKETING_SITE_URL} variant="secondary">
              Back to preb.co
            </ButtonLink>
          }
        />
      </div>
    );
  }

  if (view.outcome === "valid") {
    return (
      <div className={card}>
        <EmptyState
          icon={RiUserForbidLine}
          title="Confirm your request"
          description={
            <>
              You asked Preb to stop processing {hint}. Confirm below and we delete the results stored about this address and never look it up again.
              {reviewNote}
            </>
          }
          actions={
            <form action={confirmOptOut}>
              <input type="hidden" name="token" value={token} />
              <Button type="submit">Confirm my request</Button>
            </form>
          }
        />
      </div>
    );
  }

  if (view.outcome === "used") {
    return (
      <div className={card}>
        <EmptyState
          icon={RiCheckboxCircleLine}
          title="This request was already confirmed"
          description={`We handled it${view.confirmedAt ? ` on ${when(view.confirmedAt)}` : ""}. There is nothing more to do. If you want to add another address, send a new request.`}
          actions={
            <ButtonLink href="/opt-out" variant="secondary">
              Send another request
            </ButtonLink>
          }
        />
      </div>
    );
  }

  if (view.outcome === "expired") {
    return (
      <div className={card}>
        <EmptyState
          icon={RiTimeLine}
          title="This link has expired"
          description="Confirmation links work for 24 hours. Send the form again and we will email you a new one."
          actions={<ButtonLink href="/opt-out">Request a new link</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className={card}>
      <EmptyState
        icon={RiLinkUnlinkM}
        title="This link is not valid"
        description="It may be incomplete or outdated. Send the form again to get a fresh link."
        actions={<ButtonLink href="/opt-out">Go to the form</ButtonLink>}
      />
    </div>
  );
}
