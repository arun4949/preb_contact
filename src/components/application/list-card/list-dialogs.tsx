"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/base/buttons/button";
import { ConfirmDialog, Dialog } from "@/components/base/dialog/dialog";
import { Input } from "@/components/base/input/input";
import { useToast } from "@/components/base/toast/toast";
import { deleteList, renameList, stopList } from "@/lib/lists/actions";
import type { ListRow } from "@/lib/supabase/queries";

export type ListDialogKind = "rename" | "stop" | "delete" | null;

export interface ListDialogsProps {
  list: Pick<ListRow, "id" | "name" | "status">;
  dialog: ListDialogKind;
  onClose: () => void;
  /** Called after a successful action (e.g. navigate away after delete). */
  onDone?: (kind: Exclude<ListDialogKind, null>) => void;
}

/** Rename / Stop / Delete dialogs shared by the dashboard card and the detail header. */
export function ListDialogs({ list, dialog, onClose, onDone }: ListDialogsProps) {
  const [name, setName] = useState(list.name);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  // Reset the draft name whenever the rename dialog opens (derived state, no effect).
  const [prevDialog, setPrevDialog] = useState(dialog);
  if (dialog !== prevDialog) {
    setPrevDialog(dialog);
    if (dialog === "rename") setName(list.name);
  }

  const run = (kind: Exclude<ListDialogKind, null>, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        onClose();
        onDone?.(kind);
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong");
      }
    });

  return (
    <>
      <Dialog
        isOpen={dialog === "rename"}
        onOpenChange={(o) => !o && onClose()}
        title="Rename list"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => run("rename", () => renameList(list.id, name), "List renamed")} disabled={pending || !name.trim()}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <Input label="Name" value={name} onChange={setName} autoFocus maxLength={120} />
      </Dialog>

      <ConfirmDialog
        isOpen={dialog === "stop"}
        onOpenChange={(o) => !o && onClose()}
        title="Stop this list?"
        description="Contacts already in progress will finish and be charged. Nothing new will be submitted."
        confirmLabel="Stop list"
        tone="primary"
        isPending={pending}
        onConfirm={() => run("stop", () => stopList(list.id), list.status === "queued" ? "List stopped" : "List is stopping — in-flight contacts will finish")}
      />

      <ConfirmDialog
        isOpen={dialog === "delete"}
        onOpenChange={(o) => !o && onClose()}
        title="Delete this list?"
        description="The list, its rows and the uploaded file are removed permanently. Credits already used are not refunded."
        confirmLabel="Delete list"
        isPending={pending}
        onConfirm={() => run("delete", () => deleteList(list.id), "List deleted")}
      />
    </>
  );
}
