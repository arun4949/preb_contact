"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiMailLine } from "@remixicon/react";
import { Avatar } from "@/components/base/avatar/avatar";
import { Input } from "@/components/base/input/input";
import { useToast } from "@/components/base/toast/toast";
import { updateProfileName } from "@/lib/account/actions";
import { initialsOf } from "@/utils/initials";
import { SettingsCard, SettingsRow, SettingsValueField } from "./settings-rows";

export interface SettingsProfileProps {
  name: string;
  email: string;
  avatarUrl: string | null;
  onSaved?: () => void;
}

/** Settings › Profile (plan § 6): avatar, full name (commits on Enter / blur), read-only email. */
export function SettingsProfile({ name, email, avatarUrl, onSaved }: SettingsProfileProps) {
  const [value, setValue] = useState(name);
  const [committed, setCommitted] = useState(name);
  const [, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const commit = () => {
    const next = value.trim();
    if (next === committed) return;
    start(async () => {
      const res = await updateProfileName(next);
      if (res.ok) {
        setCommitted(next);
        onSaved?.();
        router.refresh();
      } else {
        toast.error(res.error);
        setValue(committed);
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
            className="w-[202px] shrink-0"
          />
        </SettingsRow>
        <SettingsRow label="Email" description="Sign-in address. Contact support to change it.">
          <SettingsValueField icon={RiMailLine} muted>
            <span dir="ltr">{email}</span>
          </SettingsValueField>
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}
