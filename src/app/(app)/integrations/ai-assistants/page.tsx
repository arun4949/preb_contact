import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RiArrowLeftLine, RiExternalLinkLine } from "@remixicon/react";
import { Banner } from "@/components/base/banner/banner";
import { LinkButton } from "@/components/base/buttons/link-button";
import { AssistantCards } from "@/components/application/integrations/assistant-cards";
import { AddressMock, ApproveMock, AskMock } from "@/components/application/integrations/illustrations";
import { PromptCards, type PromptExample } from "@/components/application/integrations/prompt-cards";
import { ServerUrlField } from "@/components/application/integrations/server-url-field";
import { MCP_MAX_CONTACTS, publicMcpServerUrl } from "@/lib/mcp/config";
import { getMyConnections } from "@/lib/mcp/queries";
import { getSessionContext } from "@/lib/supabase/queries";
import { docsPath } from "@/lib/site-links";

export const metadata: Metadata = { title: "AI assistants" };

const STEPS = [
  { title: "Add Preb in your assistant", text: "Open the connectors settings of Claude or ChatGPT and paste the address above.", art: AddressMock },
  { title: "Sign in and choose a workspace", text: "A Preb page opens. Sign in as usual, pick the workspace and click Allow.", art: ApproveMock },
  { title: "Ask in plain words", text: "Name the people, say what you need. The assistant shows the cost first, then the results.", art: AskMock },
];

const PROMPTS: PromptExample[] = [
  { title: "Enrich a list from the chat", prompt: "Here are 15 LinkedIn URLs. Find work emails and mobile numbers for all of them with Preb. Show me the cost first and wait for my go." },
  { title: "Check before you spend", prompt: "How many Preb credits would it cost to find work emails for these people? Which of them were enriched before?" },
  { title: "Follow up on a run", prompt: "Is my last Preb enrichment done? Show the results as a table with name, work email and mobile." },
  { title: "Find who is behind an email", prompt: "Who is behind jane@acme.com? Use Preb to find her name, job title, company and LinkedIn profile." },
  { title: "Check the balance", prompt: "How many Preb credits do I have left, and when does my plan renew?" },
  { title: "Prepare outreach", prompt: "Enrich these 10 people with work emails through Preb, then draft a short, personal intro email for each one." },
];

/** The MCP setup page: address, three steps, per-assistant guides, prompts to try. */
export default async function AiAssistantsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.profile.onboarded_at && session.role === "owner") redirect("/onboarding");
  const connections = await getMyConnections();
  const url = publicMcpServerUrl();

  return (
    <div className="flex flex-col gap-10 animate-page-enter">
      <div className="flex flex-col gap-3">
        <Link href="/integrations" className="inline-flex w-fit items-center gap-1 rounded-sm text-body-2-medium text-text-secondary outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
          <RiArrowLeftLine className="size-4" aria-hidden /> Integrations
        </Link>
        <div className="flex flex-col">
          <h1 className="text-title-2-medium text-text-primary">Preb in your AI assistant</h1>
          <p className="text-body-regular text-text-secondary">Three steps, no technical setup. Takes about two minutes.</p>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col">
            <h2 className="text-headline-medium text-text-primary">Get started</h2>
            <p className="text-body-2-regular text-text-secondary">This is the address your assistant needs. Everything else happens by signing in.</p>
          </div>
          <LinkButton href={docsPath("integrations", "use-preb-in-your-ai-tool")} target="_blank" rel="noopener noreferrer" variant="secondary" size="small" trailingIcon={RiExternalLinkLine}>
            Full guide
          </LinkButton>
        </div>
        <ServerUrlField url={url} className="max-w-[560px]" />
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => {
            const Art = s.art;
            return (
              <div key={s.title} className="flex flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-4">
                <Art />
                <div className="flex items-start gap-3 px-1 pb-1">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background-tertiary-default text-caption-1-semibold text-text-primary" aria-hidden>
                    {i + 1}
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="text-headline-medium text-text-primary">{s.title}</span>
                    <span className="text-body-2-regular text-text-secondary">{s.text}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col">
          <h2 className="text-headline-medium text-text-primary">Connect your assistant</h2>
          <p className="text-body-2-regular text-text-secondary">Each guide shows exactly where to click, with the words the assistant uses.</p>
        </div>
        <AssistantCards connections={connections} mode="detail" />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col">
          <h2 className="text-headline-medium text-text-primary">Prompts to try</h2>
          <p className="text-body-2-regular text-text-secondary">Click a card to copy it, then paste it into your assistant.</p>
        </div>
        <PromptCards prompts={PROMPTS} />
      </section>

      <Banner tone="info" title="Good to know">
        Same credits as in the app, charged only for results. One request can hold up to {MCP_MAX_CONTACTS} people, and results take one to two minutes. Every run appears in your Enrich tab with a badge for the assistant that started it. You can disconnect an assistant here at any time.
      </Banner>
    </div>
  );
}
