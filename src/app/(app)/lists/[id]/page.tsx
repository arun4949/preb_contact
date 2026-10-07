import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ListDetail } from "@/components/application/list-detail/list-detail";
import { LIST_STATUS_META } from "@/components/application/list-card/list-status";
import { extraColumns, getListContacts, getListEta, parseContactQuery } from "@/lib/lists/queries";
import { getSessionContext } from "@/lib/supabase/queries";
import { createClient } from "@/utils/supabase/server";

export async function generateMetadata({ params }: PageProps<"/lists/[id]">): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("lists").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "List" };
}

/** List detail: enriching panel + live table while running, stats + filters + table when done. */
export default async function ListDetailPage({ params, searchParams }: PageProps<"/lists/[id]">) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  const { id } = await params;
  const supabase = await createClient();
  const { data: list } = await supabase.from("lists").select("*").eq("id", id).maybeSingle();
  if (!list || list.workspace_id !== session.workspace.id) notFound();
  if (list.status === "draft") redirect("/lists/new");

  const query = parseContactQuery(await searchParams);
  const running = LIST_STATUS_META[list.status].running;
  const [contacts, eta] = await Promise.all([getListContacts(list.id, query), running ? getListEta(list) : Promise.resolve({ seconds: null, rowsPerMinute: null })]);

  return (
    <ListDetail
      list={list}
      contacts={contacts}
      query={query}
      eta={eta}
      extras={extraColumns(list)}
      canDelete={session.role !== "member" || list.created_by === session.userId}
    />
  );
}
