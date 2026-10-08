import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EnrichPage } from "@/components/application/enrich/enrich-page";
import { getManualContacts, getManualRunState } from "@/lib/enrich/queries";
import { getSessionContext } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Enrich contacts" };

/** Enrich tab: type in up to 25 contacts, run them through the engine, see every past result below. */
export default async function EnrichRoute({ searchParams }: PageProps<"/enrich">) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.profile.onboarded_at && session.role === "owner") redirect("/onboarding");

  const params = await searchParams;
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const page = Number(pick(params.page)) || 1;
  const q = pick(params.q);

  const [history, runState] = await Promise.all([
    getManualContacts(session.workspace.id, { page, q }),
    getManualRunState(session.workspace.id),
  ]);

  return <EnrichPage creditsAvailable={session.creditsAvailable} history={history} runState={runState} q={q} workspaceId={session.workspace.id} />;
}
