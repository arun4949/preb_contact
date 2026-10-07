"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RiBankCardLine,
  RiFeedbackLine,
  RiLogoutBoxRLine,
  RiQuestionLine,
  RiSettings3Line, RiTeamLine } from "@remixicon/react";
import { Avatar } from "@/components/base/avatar/avatar";
import { Dropdown, DropdownDivider, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { ThemeToggle } from "@/components/application/theme/theme-toggle";
import { signOut } from "@/lib/auth/actions";
import { initialsOf } from "@/utils/initials";


export interface AccountDropdownProps {
  name: string;
  email: string;
  avatarUrl: string | null;
  workspaceName: string;
}

/** Avatar trigger + account menu (Figma 1015:33). Settings/Billing open the settings modal (day 5/6). */
export function AccountDropdown({ name, email, avatarUrl, workspaceName }: AccountDropdownProps) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = (page: "profile" | "workspace" | "billing") => {
    setOpen(false);
    router.push(`/lists?settings=${page}`);
  };

  return (
    <Dropdown isOpen={open} onOpenChange={setOpen}>
      <DropdownTrigger aria-label="Account menu" className="rounded-full">
        <Avatar size="md" src={avatarUrl ?? undefined} alt="" initials={initialsOf(name)} color="blue" />
      </DropdownTrigger>
      <DropdownPopover aria-label="Account" placement="bottom end" className="w-[280px]">
        <div className="flex items-center gap-3 p-2">
          <Avatar size="lg" src={avatarUrl ?? undefined} alt="" initials={initialsOf(name)} color="blue" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-body-medium text-text-primary">{name}</span>
            <span className="truncate text-body-2-regular text-text-secondary">{workspaceName}</span>
            <span className="truncate text-caption-1-regular text-text-tertiary" dir="ltr">{email}</span>
          </div>
        </div>
        <DropdownDivider />
        <DropdownGroup>
          <DropdownItem onSelect={() => go("profile")}>
            <RiSettings3Line className="size-5 text-foreground-icon-secondary" aria-hidden />
            <span className="text-body-medium">Settings</span>
          </DropdownItem>
          <DropdownItem onSelect={() => go("workspace")}>
            <RiTeamLine className="size-5 text-foreground-icon-secondary" aria-hidden />
            <span className="text-body-medium">Members</span>
          </DropdownItem>
          <DropdownItem onSelect={() => go("billing")}>
            <RiBankCardLine className="size-5 text-foreground-icon-secondary" aria-hidden />
            <span className="text-body-medium">Billing</span>
          </DropdownItem>
        </DropdownGroup>
        <DropdownDivider />
        <DropdownGroup>
          <a
            href="mailto:support@preb.co?subject=Help%20with%20Preb"
            className="flex w-full cursor-pointer items-center gap-2 rounded-2lg p-2 text-start text-text-primary outline-none transition-colors hover:bg-dropdown-item-hover-background focus-visible:bg-dropdown-item-hover-background"
          >
            <RiQuestionLine className="size-5 text-foreground-icon-secondary" aria-hidden />
            <span className="text-body-medium">Help center</span>
          </a>
          <a
            href="mailto:feedback@preb.co?subject=Feedback%20on%20Preb"
            className="flex w-full cursor-pointer items-center gap-2 rounded-2lg p-2 text-start text-text-primary outline-none transition-colors hover:bg-dropdown-item-hover-background focus-visible:bg-dropdown-item-hover-background"
          >
            <RiFeedbackLine className="size-5 text-foreground-icon-secondary" aria-hidden />
            <span className="text-body-medium">Share feedback</span>
          </a>
        </DropdownGroup>
        <DropdownDivider />
        <div className="flex items-center justify-between gap-2 p-2">
          <span className="text-body-medium text-text-primary">Theme</span>
          <ThemeToggle appearance="segmented" size="small" />
        </div>
        <DropdownDivider />
        <DropdownGroup>
          <DropdownItem
            onSelect={() => {
              setOpen(false);
              start(() => signOut());
            }}
            className={pending ? "opacity-60" : undefined}
          >
            <RiLogoutBoxRLine className="size-5 text-foreground-icon-secondary" aria-hidden />
            <span className="text-body-medium">{pending ? "Logging out…" : "Log out"}</span>
          </DropdownItem>
        </DropdownGroup>
      </DropdownPopover>
    </Dropdown>
  );
}
