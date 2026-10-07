"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getSessionContext } from "@/lib/supabase/queries";

type Result = { ok: true } | { ok: false; error: string };

export async function updateProfileName(fullName: string): Promise<Result> {
  const session = await getSessionContext();
  if (!session) return { ok: false, error: "Not signed in" };
  const name = fullName.trim();
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Enter your full name (2–80 characters)." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", session.userId);
  if (error) return { ok: false, error: "Could not save your name." };
  revalidatePath("/", "layout");
  return { ok: true };
}
