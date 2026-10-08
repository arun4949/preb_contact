"use client";

import { RiGroupLine, RiMailCheckLine, RiMailCloseLine, RiSmartphoneLine, RiUserSearchLine } from "@remixicon/react";
import { StatCards, type Stat } from "@/components/application/dashboard/stat-cards";
import type { ListRow } from "@/lib/supabase/queries";

const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "0%");

/** Four plain BoardUI stat cards: Contacts · Valid emails · Risky emails · Mobile phones (or Personal emails, or Identified for reverse-only lists). */
export function ListStats({ list }: { list: ListRow }) {
  const base = list.processed_rows || list.enrichable_rows || list.total_rows;
  const wantsPhone = list.enrich_fields.includes("mobile_phone");
  const wantsPersonal = list.enrich_fields.includes("personal_email");
  const reverseOnly = list.reverse_lookup && !wantsPhone && !wantsPersonal;
  const stats: Stat[] = [
    { icon: RiGroupLine, label: "Contacts", value: fmt(list.total_rows), delta: `${fmt(list.enrichable_rows)} enrichable`, deltaColor: "neutral" },
    { icon: RiMailCheckLine, label: "Valid emails", value: fmt(list.found_work_email), delta: pct(list.found_work_email, base), deltaColor: "lime" },
    { icon: RiMailCloseLine, label: "Risky emails", value: fmt(list.risky_email), delta: pct(list.risky_email, base), deltaColor: "neutral" },
    wantsPhone
      ? { icon: RiSmartphoneLine, label: "Mobile phones", value: fmt(list.found_phone), delta: pct(list.found_phone, base), deltaColor: "lime" }
      : reverseOnly
        ? { icon: RiUserSearchLine, label: "Identified", value: fmt(list.identified_rows), delta: pct(list.identified_rows, base), deltaColor: "lime" }
        : { icon: RiMailCheckLine, label: "Personal emails", value: fmt(list.found_personal_email), delta: pct(list.found_personal_email, base), deltaColor: "lime" },
  ];
  return <StatCards variant="plain" stats={stats} />;
}
