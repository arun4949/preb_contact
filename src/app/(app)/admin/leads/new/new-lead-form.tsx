"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RiFileExcel2Line, RiFileTextLine, RiSparklingLine } from "@remixicon/react";
import { Breadcrumb, BreadcrumbItem } from "@/components/base/breadcrumb/breadcrumb";
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { CheckboxCard } from "@/components/base/checkbox/checkbox-card";
import { Input } from "@/components/base/input/input";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { Select, SelectItem } from "@/components/base/select/select";
import { Textarea } from "@/components/base/textarea/textarea";
import { useToast } from "@/components/base/toast/toast";
import { UploadDropZone } from "@/components/application/upload-drop-zone/upload-drop-zone";
import { FIELD_CARDS } from "@/lib/credits/fields";
import type { EnrichmentField } from "@/lib/credits/estimate";
import { CREDIT_COST } from "@/lib/fullenrich/mapping";
import { MAX_BYTES } from "@/lib/csv/parse";
import { createLeadShare, type AdminProfile } from "@/lib/leads/admin-actions";
import { LEAD_MAX_ROWS } from "@/lib/leads/constants";
import { parsePastedContacts } from "@/lib/leads/parse-input";
import { cx } from "@/utils/cx";
import { ShareDialog } from "./share-dialog";

type Mode = "paste" | "upload";

const PASTE_PLACEHOLDER = ["https://www.linkedin.com/in/jane-doe", "John Smith, acme.com", "Maria Garcia @ globex.io"].join("\n");

/**
 * Lead name, profile URL (LinkedIn, Reddit, ...), company, email, owner, what to find, then the
 * contacts: pasted lines or a spreadsheet. Submits as FormData so the file
 * travels with the request; the server parses, enriches and creates the share.
 */
export function NewLeadForm({ owners, meId }: { owners: AdminProfile[]; meId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<Mode>("paste");
  const [paste, setPaste] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<EnrichmentField[]>(["work_email", "mobile_phone"]);
  const [ownerId, setOwnerId] = useState(owners.some((o) => o.id === meId) ? meId : (owners[0]?.id ?? ""));
  const [leadName, setLeadName] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [created, setCreated] = useState<{ leadName: string; path: string; code: string; rows: number } | null>(null);

  const pasted = useMemo(() => parsePastedContacts(paste), [paste]);
  const ready = leadName.trim().length >= 2 && linkedin.trim().length > 0 && fields.length > 0 && (mode === "paste" ? pasted.cells.length > 0 : file !== null);

  const toggle = (key: EnrichmentField, on: boolean) => setFields((f) => (on ? [...new Set([...f, key])] : f.filter((k) => k !== key)));

  const submit = () => {
    if (!ready || pending) return;
    const fd = new FormData();
    fd.set("lead_name", leadName);
    fd.set("lead_linkedin_url", linkedin);
    fd.set("lead_company", company);
    fd.set("lead_email", email);
    fd.set("owner_id", ownerId);
    for (const f of fields) fd.append("field", f);
    fd.set("mode", mode);
    if (mode === "paste") fd.set("paste", paste);
    else if (file) fd.set("file", file);
    start(async () => {
      const res = await createLeadShare(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCreated(res.data);
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-8 animate-page-enter">
      <div className="flex flex-col gap-2">
        <Breadcrumb>
          <BreadcrumbItem href="/admin/leads">Leads</BreadcrumbItem>
          <BreadcrumbItem current>New lead enrichment</BreadcrumbItem>
        </Breadcrumb>
        <h1 className="text-title-2-medium text-text-primary">New lead enrichment</h1>
        <p className="text-body-regular text-text-secondary">
          Enrich up to {LEAD_MAX_ROWS} profiles for a prospect. The list runs in the Preb outreach workspace and is not charged to anyone. You get a link and a 4-digit code to send in the chat.
        </p>
      </div>

      <form
        className="flex flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <section className="flex flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-5 md:p-6">
          <h2 className="text-headline-medium text-text-primary">The lead</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Name" value={leadName} onChange={setLeadName} placeholder="Jane Doe" isDisabled={pending} autoFocus />
            <Input label="Profile URL" value={linkedin} onChange={setLinkedin} placeholder="https://www.linkedin.com/in/jane-doe" inputDir="ltr" isDisabled={pending} hint="LinkedIn, Reddit or any other link where the lead found you." />
            <Input label="Company (optional)" value={company} onChange={setCompany} placeholder="Acme" isDisabled={pending} />
            <Input label="Email (optional)" value={email} onChange={setEmail} placeholder="jane@acme.com" inputDir="ltr" type="email" isDisabled={pending} hint="Prefills the sign-in form when the lead clicks Sign up." />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-body-2-medium text-text-secondary">Owner</span>
            <Select aria-label="Owner" selectedKey={ownerId} onSelectionChange={(k) => setOwnerId(String(k))} triggerClassName="w-full md:w-[320px]" popoverClassName="w-[320px]" isDisabled={pending}>
              {owners.map((o) => (
                <SelectItem key={o.id} id={o.id} textValue={o.name}>
                  {o.name}
                </SelectItem>
              ))}
            </Select>
            <span className="text-caption-1-regular text-text-tertiary">Shown to the lead with the portrait on the page and in the popup.</span>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-5 md:p-6">
          <div>
            <h2 className="text-headline-medium text-text-primary">What to find</h2>
            <p className="text-body-regular text-text-secondary">Same options as a customer list. Costs are measured, not charged.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {FIELD_CARDS.map((c) => (
              <CheckboxCard
                key={c.key}
                isSelected={fields.includes(c.key)}
                onChange={(on) => toggle(c.key, on)}
                isDisabled={pending}
                title={
                  <span className="flex items-center gap-2">
                    {c.title}
                    <Chip variant="caption" color="soft">
                      {CREDIT_COST[c.key]} {CREDIT_COST[c.key] === 1 ? "credit" : "credits"}
                    </Chip>
                  </span>
                }
                description={c.description}
                className={cx("items-start", fields.includes(c.key) && "border-accent-600")}
              />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-headline-medium text-text-primary">The profiles</h2>
              <p className="text-body-regular text-text-secondary">Paste what the lead sent you, or upload their spreadsheet.</p>
            </div>
            <SegmentedControl
              aria-label="How to add profiles"
              selectedKeys={[mode]}
              onSelectionChange={(keys) => {
                const next = [...(keys as Set<string>)][0] as Mode | undefined;
                if (next) setMode(next);
              }}
            >
              <SegmentedControlItem id="paste">Paste</SegmentedControlItem>
              <SegmentedControlItem id="upload">Upload</SegmentedControlItem>
            </SegmentedControl>
          </div>

          {mode === "paste" ? (
            <div className="flex flex-col gap-2">
              <Textarea
                label="One person per line"
                value={paste}
                onChange={setPaste}
                rows={8}
                placeholder={PASTE_PLACEHOLDER}
                hint="A LinkedIn profile URL, or a name and the company domain separated by a comma or @."
                isDisabled={pending}
              />
              <div className="flex flex-wrap items-center gap-2 text-caption-1-regular text-text-tertiary" aria-live="polite">
                <Chip variant="caption" color={pasted.cells.length ? "lime" : "neutral"}>
                  {pasted.cells.length} {pasted.cells.length === 1 ? "profile" : "profiles"}
                </Chip>
                {pasted.rejected.length ? (
                  <span className="text-text-error-primary">
                    {pasted.rejected.length} {pasted.rejected.length === 1 ? "line" : "lines"} could not be read: {pasted.rejected.slice(0, 2).map((l) => `"${l.slice(0, 40)}"`).join(", ")}
                  </span>
                ) : null}
                {pasted.truncated ? <span>Only the first {LEAD_MAX_ROWS} are used.</span> : null}
              </div>
            </div>
          ) : file ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border-button-default bg-background-secondary-default px-4 py-3">
              <span className="flex min-w-0 items-center gap-3">
                {/\.xlsx?$/i.test(file.name) ? <RiFileExcel2Line className="size-6 shrink-0 text-foreground-icon-secondary" aria-hidden /> : <RiFileTextLine className="size-6 shrink-0 text-foreground-icon-secondary" aria-hidden />}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-body-medium text-text-primary">{file.name}</span>
                  <span className="text-caption-1-regular text-text-tertiary">Columns are mapped automatically. The first {LEAD_MAX_ROWS} rows are used.</span>
                </span>
              </span>
              <Button variant="secondary" size="small" onClick={() => setFile(null)} disabled={pending}>
                Replace
              </Button>
            </div>
          ) : (
            <UploadDropZone
              allowedExtensions={["csv", "xlsx", "xls", "txt", "tsv"]}
              maxBytes={MAX_BYTES}
              upload={async (f, onProgress) => {
                onProgress(100);
                setFile(f);
              }}
            />
          )}
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link href="/admin/leads" className="text-body-medium text-text-secondary hover:text-text-primary">
            Cancel
          </Link>
          <Button type="submit" leadingIcon={RiSparklingLine} disabled={!ready || pending} aria-busy={pending}>
            {pending ? "Creating…" : "Create and enrich"}
          </Button>
        </div>
      </form>

      <ShareDialog
        created={created}
        onClose={() => {
          setCreated(null);
          router.push("/admin/leads");
        }}
      />
    </div>
  );
}
