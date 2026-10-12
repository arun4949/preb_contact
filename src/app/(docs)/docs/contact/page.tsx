import type { Metadata } from "next";
import { Breadcrumb, BreadcrumbItem } from "@/components/base/breadcrumb/breadcrumb";
import { DocsSupportCard } from "@/components/application/docs/docs-support-card";
import { DocsH2, DocsList, DocsP } from "@/components/application/docs/docs-primitives";
import { CONTACT_PATH } from "@/lib/docs/registry";
import { docsPath } from "@/lib/site-links";

export const metadata: Metadata = {
  title: "Contact support",
  description: "How to reach the Preb team, and what to include so we can help fast.",
  alternates: { canonical: CONTACT_PATH },
};

export default function DocsContactPage() {
  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-8">
      <Breadcrumb>
        <BreadcrumbItem href={docsPath()}>Help center</BreadcrumbItem>
        <BreadcrumbItem current>Contact support</BreadcrumbItem>
      </Breadcrumb>
      <header className="flex flex-col gap-2">
        <h1 className="text-title-1-semibold text-text-primary md:text-display-4-semibold">Contact support</h1>
        <p className="text-body-regular text-text-secondary">A small team answers every message personally, on business days, usually within a few hours.</p>
      </header>
      <DocsSupportCard compact />
      <div className="flex flex-col gap-5">
        <DocsH2 id="ways-to-reach-us">Ways to reach us</DocsH2>
        <DocsList
          items={[
            <>
              <strong className="text-body-medium text-text-primary">In the app.</strong> Open the account menu in the top right and click <strong className="text-body-medium text-text-primary">Contact support</strong>. The conversation stays attached to your account, so we can look things up right away.
            </>,
            <>
              <strong className="text-body-medium text-text-primary">From this page.</strong> The button above opens the same messenger without signing in.
            </>,
            <>
              <strong className="text-body-medium text-text-primary">By email.</strong>{" "}
              <a href="mailto:support@preb.co" className="rounded-sm text-accent-600 underline-offset-3 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring" dir="ltr">
                support@preb.co
              </a>
              . For volume pricing and invoicing write to{" "}
              <a href="mailto:sales@preb.co" className="rounded-sm text-accent-600 underline-offset-3 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring" dir="ltr">
                sales@preb.co
              </a>
              .
            </>,
          ]}
        />
        <DocsH2 id="what-to-include">What to include</DocsH2>
        <DocsP>The more of this you add, the faster we can help:</DocsP>
        <DocsList items={["The name of your workspace and the list you are asking about.", "One or two example rows, for instance the name and company of a person with a surprising result.", "What you expected and what you saw instead, with the time it happened.", "A screenshot, if the problem is on the screen."]} />
        <DocsH2 id="feature-ideas">Feature ideas</DocsH2>
        <DocsP>
          We read every suggestion. Send it the same way as a support question, with <strong className="text-body-medium text-text-primary">Contact support</strong> in the account menu or the button above.
        </DocsP>
      </div>
    </article>
  );
}
