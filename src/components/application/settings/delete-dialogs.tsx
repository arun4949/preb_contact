"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RiDeleteBinLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { Dialog } from "@/components/base/dialog/dialog";
import { Input } from "@/components/base/input/input";
import { useToast } from "@/components/base/toast/toast";
import { deleteAccount, deleteWorkspace } from "@/lib/account/actions";

/**
 * Typed-confirmation dialogs for the two irreversible settings actions
 * (privacy policy § 11). Built on `Dialog` with a custom footer like the
 * rename dialog: the danger button stays disabled until the typed value
 * matches, Enter submits only then, Escape cancels.
 */

interface TypedConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  intro: string;
  consequences: string[];
  inputLabel: string;
  /** What the user has to type, compared case-insensitively after trimming. */
  expected: string;
  placeholder?: string;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => Promise<{ ok: true; data: { redirectTo: string } } | { ok: false; error: string }>;
  successTitle: string;
  /** Extra content under the input, e.g. a note about invoices. */
  footnote?: ReactNode;
}

function TypedConfirmDialog({ isOpen, onClose, title, intro, consequences, inputLabel, expected, placeholder, confirmLabel, pendingLabel, onConfirm, successTitle, footnote }: TypedConfirmProps) {
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const matches = typed.trim().toLowerCase() === expected.trim().toLowerCase();

  const close = () => {
    if (pending) return;
    setTyped("");
    onClose();
  };

  const submit = () => {
    if (!matches || pending) return;
    start(async () => {
      const res = await onConfirm();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(successTitle);
      setTyped("");
      onClose();
      router.push(res.data.redirectTo);
      router.refresh();
    });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(o) => !o && close()}
      isDismissable={!pending}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} disabled={!matches || pending} aria-busy={pending}>
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background-error-default" aria-hidden>
            <RiDeleteBinLine className="size-5 text-foreground-icon-error" />
          </span>
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-body-regular text-text-secondary">{intro}</p>
            <ul className="flex flex-col gap-1 text-body-2-regular text-text-secondary">
              {consequences.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-[9px] size-1 shrink-0 rounded-full bg-foreground-icon-tertiary" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Input label={inputLabel} value={typed} onChange={setTyped} placeholder={placeholder} inputDir="ltr" autoFocus autoComplete="off" isDisabled={pending} />
        {footnote ? <p className="text-caption-1-regular text-text-tertiary">{footnote}</p> : null}
      </form>
    </Dialog>
  );
}

export function DeleteAccountDialog({ isOpen, onClose, email, ownsWorkspace }: { isOpen: boolean; onClose: () => void; email: string; ownsWorkspace: boolean }) {
  const consequences = [
    "Your profile, sign-in and notifications are deleted.",
    "You leave every workspace you are a member of. Lists you created there stay with the workspace.",
  ];
  if (ownsWorkspace) {
    consequences.push("Workspaces you own are deleted with all their lists, contacts, uploaded files and credits.", "Any subscription ends immediately. Credits already used are not refunded.");
  }
  return (
    <TypedConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Delete your account?"
      intro="This cannot be undone. Here is what happens:"
      consequences={consequences}
      inputLabel="Type your email address to confirm"
      expected={email}
      placeholder={email}
      confirmLabel="Delete account"
      pendingLabel="Deleting…"
      onConfirm={() => deleteAccount(email)}
      successTitle="Your account has been deleted"
      footnote="Invoices are kept for as long as tax law requires, see our Privacy Policy."
    />
  );
}

export function DeleteWorkspaceDialog({ isOpen, onClose, workspaceName }: { isOpen: boolean; onClose: () => void; workspaceName: string }) {
  return (
    <TypedConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Delete ${workspaceName}?`}
      intro="This cannot be undone. Here is what happens:"
      consequences={[
        "Every list, contact, result and uploaded file is deleted.",
        "All remaining credits are lost and the subscription ends immediately. Credits already used are not refunded.",
        "Teammates lose access and are notified.",
      ]}
      inputLabel="Type the workspace name to confirm"
      expected={workspaceName}
      placeholder={workspaceName}
      confirmLabel="Delete workspace"
      pendingLabel="Deleting…"
      onConfirm={() => deleteWorkspace(workspaceName)}
      successTitle="Workspace deleted"
      footnote="Invoices are kept for as long as tax law requires, see our Privacy Policy."
    />
  );
}
