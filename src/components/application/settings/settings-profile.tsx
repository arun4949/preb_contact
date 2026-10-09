"use client";

import { useState, useTransition } from "react";
import { RiMailLine } from "@remixicon/react";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Switch } from "@/components/base/switch/switch";
import { useToast } from "@/components/base/toast/toast";
import { updateProductNews, updateProfileName } from "@/lib/account/actions";
import { cx } from "@/utils/cx";
import { initialsOf } from "@/utils/initials";
import { DeleteAccountDialog } from "./delete-dialogs";
import { SettingsCard, SettingsRow, SettingsSectionLabel, SettingsValueField } from "./settings-rows";

export interface SettingsProfileProps {
  name: string;
  email: string;
  avatarUrl: string | null;
  /** Opt-out flag for product news (mirrored to the Resend contact). */
  productNews: boolean;
  /** Owners delete their workspace along with the account; the dialog says so. */
  ownsWorkspace: boolean;
  onSaved?: () => void;
}

/**
 * Settings › Profile (plan § 6): avatar, full name (commits on Enter / blur),
 * read-only email, the product-news switch and account deletion
 * (privacy policy § 11 and § 15).
 */
export function SettingsProfile({ name, email, avatarUrl, productNews, ownsWorkspace, onSaved }: SettingsProfileProps) {
  const [value, setValue] = useState(name);
  const [committed, setCommitted] = useState(name);
  const [pending, start] = useTransition();
  const [news, setNews] = useState(productNews);
  const [newsPending, startNews] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  const commit = () => {
    const next = value.trim();
    if (next === committed) return;
    start(async () => {
      const res = await updateProfileName(next);
      if (res.ok) {
        setCommitted(next);
        onSaved?.();
      } else {
        toast.error(res.error);
        setValue(committed);
      }
    });
  };

  // Optimistic: the switch flips at once and rolls back if the save fails.
  const toggleNews = (enabled: boolean) => {
    setNews(enabled);
    startNews(async () => {
      const res = await updateProductNews(enabled);
      if (res.ok) {
        onSaved?.();
      } else {
        toast.error(res.error);
        setNews(!enabled);
      }
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar size="lg" src={avatarUrl ?? undefined} alt="" initials={initialsOf(committed || email)} color="blue" />
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-headline-medium text-text-primary">{committed || "Your name"}</p>
          <p className="truncate text-body-2-regular text-text-secondary" dir="ltr">
            {email}
          </p>
        </div>
      </div>
      <SettingsCard>
        <SettingsRow label="Full name" description="Shown to your teammates and on list ownership.">
          <Input
            aria-label="Full name"
            size="small"
            value={value}
            onChange={setValue}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLElement).blur();
            }}
            aria-busy={pending}
            className={cx("w-full shrink-0 sm:w-[202px] transition-opacity", pending && "opacity-60")}
          />
        </SettingsRow>
        <SettingsRow label="Email" description="Sign-in address. Contact support to change it.">
          <SettingsValueField icon={RiMailLine} muted>
            <span dir="ltr">{email}</span>
          </SettingsValueField>
        </SettingsRow>
      </SettingsCard>

      <div className="flex w-full flex-col gap-2">
        <SettingsSectionLabel>Emails</SettingsSectionLabel>
        <SettingsCard>
          <SettingsRow label="Product news" description="Occasional updates about new features and tips. Sign-in links and enrichment notices are always sent.">
            <Switch aria-label="Product news" size="sm" isSelected={news} onChange={toggleNews} isDisabled={newsPending} className={cx("shrink-0 transition-opacity", newsPending && "opacity-60")} />
          </SettingsRow>
        </SettingsCard>
      </div>

      <div className="flex w-full flex-col gap-2">
        <SettingsSectionLabel>Account</SettingsSectionLabel>
        <SettingsCard>
          <SettingsRow
            label="Delete account"
            description={ownsWorkspace ? "Removes your profile and memberships. Workspaces you own are deleted with all their data." : "Removes your profile and your memberships. Lists you created stay with their workspace."}
          >
            <Button variant="danger" size="small" className="shrink-0" onClick={() => setDeleting(true)}>
              Delete account
            </Button>
          </SettingsRow>
        </SettingsCard>
      </div>

      <DeleteAccountDialog isOpen={deleting} onClose={() => setDeleting(false)} email={email} ownsWorkspace={ownsWorkspace} />
    </div>
  );
}
