"use client";

import Link from "next/link";
import { RiCustomerService2Line } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { useSupportChat } from "@/components/foundations/featurebase/featurebase";
import { CONTACT_PATH } from "@/lib/docs/registry";
import { cx } from "@/utils/cx";

/** "Still need help?" card. Opens the messenger, which boots anonymously on public pages. */
export function DocsSupportCard({ className, compact = false }: { className?: string; compact?: boolean }) {
  const chat = useSupportChat();
  return (
    <div className={cx("flex flex-col gap-4 rounded-3xl border border-border-button-default bg-background-secondary-default p-5 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex flex-col gap-1">
        <span className="text-headline-medium text-text-primary">Still need help?</span>
        <span className="text-body-regular text-text-secondary">
          {compact ? "Our team answers on business days, usually within a few hours." : "Message our team from here. We answer on business days, usually within a few hours."}
        </span>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
        <Link href={CONTACT_PATH} className="whitespace-nowrap text-body-medium text-text-secondary underline-offset-3 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring rounded-sm">
          Other ways to reach us
        </Link>
        <Button leadingIcon={RiCustomerService2Line} onClick={() => chat.showNewMessage()}>
          Contact support
        </Button>
      </div>
    </div>
  );
}
