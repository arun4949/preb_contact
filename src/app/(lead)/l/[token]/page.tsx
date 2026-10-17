import { cookies } from "next/headers";
import { after } from "next/server";
import { LeadGate } from "@/components/application/lead/lead-gate";
import { LeadHeader } from "@/components/application/lead/lead-header";
import { LeadUnavailable } from "@/components/application/lead/lead-unavailable";
import { LeadView } from "@/components/application/lead/lead-view";
import { LIST_STATUS_META } from "@/components/application/list-card/list-status";
import { isAdminEmail } from "@/lib/auth/work-email";
import { leadCookieName, verifyLeadAccess } from "@/lib/leads/access-cookie";
import { logShareEvent, touchShare } from "@/lib/leads/events";
import { getShareByToken } from "@/lib/leads/queries";
import { extraColumns, getListContacts, getListEta, getListInsights, parseContactQuery } from "@/lib/lists/queries";
import { firstNameFor } from "@/lib/email/name";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

/** A lock that is still in force, or null. */
function activeLock(until: string | null): string | null {
  return until && new Date(until).getTime() > Date.now() ? until : null;
}

/**
 * /l/<token>: the lead magnet page. A prospect opens the link from a chat,
 * types the 4-digit code and sees the enriched sample list exactly like a
 * customer would (stats, filters, table, CSV download), without an account.
 * A signed-in Preb admin skips the gate (preview) and triggers no events.
 */
export default async function LeadSharePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const found = await getShareByToken(token);
  if (!found) return <LeadUnavailable />;
  const { share, list, owner } = found;

  const user = await getUser();
  const isAdmin = Boolean(user?.email && isAdminEmail(user.email));
  if ((share.revoked_at || list.status === "draft") && !isAdmin) return <LeadUnavailable />;

  const leadFirstName = firstNameFor(share.lead_name, "") || share.lead_name;
  const cookieValue = (await cookies()).get(leadCookieName(share.id))?.value;
  const unlocked = isAdmin || verifyLeadAccess(share.id, cookieValue);

  if (!unlocked) {
    after(async () => {
      const admin = createAdminClient();
      await touchShare(admin, share.id, "first_opened_at");
      await logShareEvent(admin, share.id, "opened");
    });
    return (
      <>
        <LeadHeader token={token} isAdmin={false} />
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
          <LeadGate token={token} owner={owner} leadFirstName={leadFirstName} locked={activeLock(share.locked_until)} />
        </main>
      </>
    );
  }

  const admin = createAdminClient();
  const query = parseContactQuery(await searchParams);
  const running = LIST_STATUS_META[list.status].running;
  const [contacts, insights, eta] = await Promise.all([
    getListContacts(list.id, query, admin),
    getListInsights(list.id, admin),
    running ? getListEta(list, admin) : Promise.resolve({ seconds: null, rowsPerMinute: null }),
  ]);

  return (
    <>
      <LeadHeader token={token} isAdmin={isAdmin} />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-8 md:px-6 lg:px-10">
        <LeadView
          token={token}
          shareId={share.id}
          list={list}
          contacts={contacts}
          insights={insights}
          query={query}
          eta={eta}
          extras={extraColumns(list)}
          owner={owner}
          leadFirstName={leadFirstName}
          isAdmin={isAdmin}
          revoked={Boolean(share.revoked_at)}
        />
      </main>
    </>
  );
}
