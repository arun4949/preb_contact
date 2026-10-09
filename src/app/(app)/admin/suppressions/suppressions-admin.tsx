"use client";

import { useState, useTransition } from "react";
import { RiUserForbidLine } from "@remixicon/react";
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { ConfirmDialog } from "@/components/base/dialog/dialog";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import { useToast } from "@/components/base/toast/toast";
import { addSuppression, fetchSuppressions, removeSuppression, type SuppressionRecord } from "@/lib/suppression/admin-actions";
import type { SuppressionKind } from "@/lib/suppression/identifiers";

const KIND_LABEL: Record<SuppressionKind, string> = { email: "Email", linkedin: "LinkedIn", phone: "Phone" };
const PLACEHOLDER: Record<SuppressionKind, string> = { email: "person@company.com", linkedin: "https://www.linkedin.com/in/handle", phone: "+1 555 123 4567" };
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** Page shell: add form on top, the list of suppressed identifiers below. */
export function SuppressionsAdmin({ entries: initial }: { entries: SuppressionRecord[] }) {
  const [entries, setEntries] = useState(initial);
  const [kind, setKind] = useState<SuppressionKind>("email");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [removing, setRemoving] = useState<SuppressionRecord | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  const reload = () => void fetchSuppressions().then(setEntries);

  const submit = () => {
    if (!value.trim() || pending) return;
    start(async () => {
      const res = await addSuppression(kind, value, note);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.data.hint} is suppressed`, {
        description: res.data.cleared === 0 ? "No stored data matched. Future enrichments are blocked." : `${res.data.cleared.toLocaleString("en-US")} stored ${res.data.cleared === 1 ? "row was" : "rows were"} cleared. Future enrichments are blocked.`,
      });
      setValue("");
      setNote("");
      reload();
    });
  };

  return (
    <div className="flex flex-col gap-8 animate-page-enter">
      <div className="flex flex-col gap-1">
        <h1 className="text-title-2-medium text-text-primary">Suppressions</h1>
        <p className="text-body-regular text-text-secondary">
          People who asked not to be processed through Preb. Adding an identifier clears their stored results in every workspace and blocks future enrichment. Only a hash and a masked hint are kept. Visible to Preb admins only.
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-5 md:p-6">
        <h2 className="text-headline-medium text-text-primary">Add a person</h2>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1.5">
              <span className="text-body-2-medium text-text-secondary">Identifier</span>
              <Select aria-label="Identifier type" selectedKey={kind} onSelectionChange={(k) => setKind(k as SuppressionKind)} triggerClassName="w-full sm:w-[150px]" popoverClassName="w-[200px]">
                <SelectItem id="email">Email</SelectItem>
                <SelectItem id="linkedin">LinkedIn URL</SelectItem>
                <SelectItem id="phone">Phone</SelectItem>
              </Select>
            </div>
            <Input label="Value" value={value} onChange={setValue} placeholder={PLACEHOLDER[kind]} inputDir="ltr" className="min-w-0 flex-1" isDisabled={pending} />
          </div>
          <Input label="Note (optional)" value={note} onChange={setNote} placeholder="Request received by email on Oct 9" isDisabled={pending} />
          <div className="flex justify-end">
            <Button type="submit" leadingIcon={RiUserForbidLine} disabled={!value.trim() || pending} aria-busy={pending}>
              {pending ? "Suppressing…" : "Suppress and clear data"}
            </Button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-headline-medium text-text-primary">
          {entries.length} {entries.length === 1 ? "person" : "people"} suppressed
        </h2>
        {entries.length === 0 ? (
          <div className="rounded-2xl bg-background-secondary-default">
            <EmptyState size="inline" icon={RiUserForbidLine} title="Nobody is suppressed." description="Requests from people who object to processing land here." />
          </div>
        ) : (
          <Table aria-label="Suppressed identifiers" size="sm" containerClassName="rounded-2xl">
            <TableHeader>
              <TableColumn isRowHeader>Identifier</TableColumn>
              <TableColumn>Type</TableColumn>
              <TableColumn>Note</TableColumn>
              <TableColumn>Added</TableColumn>
              <TableColumn>By</TableColumn>
              <TableColumn className="text-end">Action</TableColumn>
            </TableHeader>
            <TableBody>
              {entries.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <span className="text-body-medium text-text-primary" dir="ltr">
                      {s.hint}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Chip variant="caption" color="neutral">
                      {KIND_LABEL[s.kind]}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <span className="line-clamp-1 max-w-[320px] text-caption-1-regular text-text-tertiary">{s.note ?? ""}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{when(s.createdAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{s.createdBy ?? ""}</TableCell>
                  <TableCell className="text-end">
                    <Button variant="secondary" size="small" onClick={() => setRemoving(s)}>
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <ConfirmDialog
        isOpen={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        icon={RiUserForbidLine}
        title={`Remove ${removing?.hint ?? ""}?`}
        description="Data that was already cleared stays cleared. The person can be enriched again in future lists."
        confirmLabel="Remove"
        tone="primary"
        isPending={pending}
        onConfirm={() => {
          if (!removing) return;
          const target = removing;
          start(async () => {
            const res = await removeSuppression(target.id);
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            setRemoving(null);
            toast.success("Entry removed");
            reload();
          });
        }}
      />
    </div>
  );
}
