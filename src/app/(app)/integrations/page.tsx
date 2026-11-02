import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RiArrowRightLine, RiLightbulbLine } from "@remixicon/react";
import { Chip } from "@/components/base/badges/chip";
import { ButtonLink } from "@/components/base/buttons/button";
import { AssistantCards } from "@/components/application/integrations/assistant-cards";
import { ChatMock } from "@/components/application/integrations/illustrations";
import { getMyConnections } from "@/lib/mcp/queries";
import { getSessionContext } from "@/lib/supabase/queries";
import { docsPath } from "@/lib/site-links";

export const metadata: Metadata = { title: "Integrations" };

/**
 * Integrations tab: where Preb plugs into the tools people already use. For
 * now that is AI assistants over MCP (Claude, ChatGPT, any MCP client); the
 * page is laid out so CRM and workflow integrations slot in as new sections.
 */
export default async function IntegrationsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.profile.onboarded_at && session.role === "owner") redirect("/onboarding");
  const connections = await getMyConnections();
  const connected = connections.length;

  return (
    <div className="flex flex-col gap-10 animate-page-enter">
      <div className="flex flex-col">
        <h1 className="text-title-2-medium text-text-primary">Integrations</h1>
        <p className="text-body-regular text-text-secondary">Bring Preb into the tools you already work in.</p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-headline-medium text-text-primary">Preb in your AI assistant</h2>
        <div className="grid gap-6 rounded-3xl border border-border-button-default bg-background-primary-default p-5 md:grid-cols-[1.1fr_1fr] md:p-6">
          <ChatMock />
          <div className="flex flex-col justify-center gap-4">
            <div className="flex items-center gap-2">
              <Chip variant="caption" color="purple">New</Chip>
              {connected ? (
                <Chip variant="caption" color="lime">{connected === 1 ? "1 assistant connected" : `${connected} assistants connected`}</Chip>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="text-title-3-semibold text-text-primary">Ask for emails and numbers in plain words</h3>
              <p className="text-body-regular text-text-secondary">
                Connect Claude or ChatGPT once, then enrich people straight from the chat. The same verified data and the same credits as in the app, and every run shows up in your Enrich tab.
              </p>
            </div>
            <ul className="flex flex-col gap-1.5 text-body-2-regular text-text-secondary">
              <li>Sign in with your Preb account, no keys to copy.</li>
              <li>Your assistant checks the cost with you before anything is spent.</li>
              <li>Disconnect any time from this page.</li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/integrations/ai-assistants" trailingIcon={RiArrowRightLine}>
                Set up
              </ButtonLink>
              <ButtonLink href={docsPath("integrations", "use-preb-in-your-ai-tool")} variant="secondary" target="_blank" rel="noopener noreferrer">
                How it works
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col">
          <h2 className="text-headline-medium text-text-primary">AI assistants</h2>
          <p className="text-body-2-regular text-text-secondary">Pick your assistant. Connect opens the step-by-step guide; the address and example prompts are under Set up.</p>
        </div>
        <AssistantCards connections={connections} mode="overview" />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-headline-medium text-text-primary">Something missing?</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href={docsPath("contact")}
            className="flex flex-col gap-4 rounded-3xl border border-dashed border-border-button-default bg-background-primary-default p-5 outline-none transition-colors duration-150 ease hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-background-secondary-default text-foreground-icon-secondary">
              <RiLightbulbLine className="size-5" aria-hidden />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-headline-medium text-text-primary">Suggest an integration</span>
              <span className="text-body-2-regular text-text-secondary">Your CRM, your ATS, a workflow tool: tell us what would save you the most time and we will look into it.</span>
            </span>
            <span className="mt-auto inline-flex items-center gap-1 text-body-2-medium text-accent-600">
              Tell us <RiArrowRightLine className="size-4" aria-hidden />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
