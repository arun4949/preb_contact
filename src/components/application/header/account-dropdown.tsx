"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RiBankCardLine,
  RiFeedbackLine,
  RiShieldCheckLine,
  RiLogoutBoxRLine,
  RiMegaphoneLine,
  RiPulseLine,
  RiQuestionLine,
  RiSettings3Line, RiTeamLine } from "@remixicon/react";
import { Avatar } from "@/components/base/avatar/avatar";
import { Dropdown, DropdownDivider, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { openCookiePreferences } from "@/components/foundations/termly/termly-cmp";
import { ThemeToggle } from "@/components/application/theme/theme-toggle";
import { useSupportChat } from "@/components/foundations/featurebase/featurebase";
import { signOut } from "@/lib/auth/actions";
import { useSettingsUrl } from "@/components/application/settings/use-settings-url";
import { initialsOf } from "@/utils/initials";


export interface AccountDropdownProps {
  name: string;
  email: string;
  avatarUrl: string | null;
  workspaceName: string;
  /** Preb admins (`ADMIN_EMAILS`) get the Admin group. */
  isAdmin?: boolean;
}

/** Avatar trigger + account menu (Figma 1015:33). Settings/Billing open the settings modal; Help and feedback open the Featurebase messenger. */
export function AccountDropdown({ name, email, avatarUrl, workspaceName, isAdmin = false }: AccountDropdownProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { openSettings } = useSettingsUrl();
  const chat = useSupportChat();
  // Opens the settings modal on the current page without a server round trip.
  const go = (page: "profile" | "workspace" | "billing") => {
    setOpen(false);
    openSettings(page);
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
          <DropdownItem
            onSelect={() => {
              setOpen(false);
              chat.show();
            }}
          >
            <RiQuestionLine className="size-5 text-foreground-icon-secondary" aria-hidden />
            <span className="text-body-medium">Help center</span>
          </DropdownItem>
          <DropdownItem
            onSelect={() => {
              setOpen(false);
              chat.showNewMessage();
            }}
          >
            <RiFeedbackLine className="size-5 text-foreground-icon-secondary" aria-hidden />
            <span className="text-body-medium">Share feedback</span>
          </DropdownItem>
          <DropdownItem
            onSelect={() => {
              setOpen(false);
              openCookiePreferences();
            }}
          >
            <RiShieldCheckLine className="size-5 text-foreground-icon-secondary" aria-hidden />
            <span className="text-body-medium">Cookie preferences</span>
          </DropdownItem>
        </DropdownGroup>
        {isAdmin ? (
          <>
            <DropdownDivider />
            <DropdownGroup label="Admin">
              <DropdownItem
                onSelect={() => {
                  setOpen(false);
                  router.push("/admin/notifications");
                }}
              >
                <RiMegaphoneLine className="size-5 text-foreground-icon-secondary" aria-hidden />
                <span className="text-body-medium">Announcements</span>
              </DropdownItem>
              <DropdownItem
                onSelect={() => {
                  setOpen(false);
                  router.push("/admin/ops");
                }}
              >
                <RiPulseLine className="size-5 text-foreground-icon-secondary" aria-hidden />
                <span className="text-body-medium">Ops</span>
              </DropdownItem>
            </DropdownGroup>
          </>
        ) : null}
        <DropdownDivider />
        <div className="flex items-center justify-between gap-2 p-2">
          <span className="text-body-medium text-text-primary">Theme</span>
          <ThemeToggle appearance="segmented" size="small" />
        </div>
        <DropdownDivider />
        <DropdownGroup>
          <DropdownItem
            onSelect={() => {
              // Keep the menu open so "Logging out…" stays visible until the redirect.
              if (pending) return;
              // Drop the cached messenger identity before the session goes.
              chat.shutdown();
              start(() => signOut());
            }}
            className={pending ? "pointer-events-none opacity-60" : undefined}
          >
            <RiLogoutBoxRLine className="size-5 text-foreground-icon-secondary" aria-hidden />
            <span className="text-body-medium">{pending ? "Logging out…" : "Log out"}</span>
          </DropdownItem>
        </DropdownGroup>
      </DropdownPopover>
    </Dropdown>
  );
}
