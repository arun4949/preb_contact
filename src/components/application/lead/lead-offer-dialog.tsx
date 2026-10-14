"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { RiGiftLine } from "@remixicon/react";
import { ButtonLink } from "@/components/base/buttons/button";
import { Dialog } from "@/components/base/dialog/dialog";
import { LEAD_OFFER_AFTER_DOWNLOAD_MS, LEAD_OFFER_CREDITS, LEAD_OFFER_DELAY_MS, LEAD_OFFER_OPEN_EVENT, leadGoPath, leadOfferStorageKey } from "@/lib/leads/constants";
import type { LeadOwnerView } from "@/lib/leads/owners";
import { markLeadPopupShown } from "@/lib/leads/public-actions";
import { OwnerPortrait } from "./owner-portrait";

function readShown(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return true; // storage unavailable: never nag
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

/** Ask the popup to open (the Download menu calls this after every download). */
export function requestLeadOffer() {
  window.dispatchEvent(new Event(LEAD_OFFER_OPEN_EVENT));
}

/**
 * The conversion popup: "{Owner} left you 50 free credits!". Opens 5 s after
 * the list is shown, once per browser (localStorage), and again after every
 * download. Never rendered for admins.
 * The CTA goes through the `go` route like the header buttons.
 */
export function LeadOfferDialog({ token, shareId, owner }: { token: string; shareId: string; owner: LeadOwnerView }) {
  const key = leadOfferStorageKey(shareId);
  // Server snapshot "shown" so the dialog never flashes during hydration.
  const alreadyShown = useSyncExternalStore(subscribe, () => readShown(key), () => true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (alreadyShown) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, "1");
      } catch {
        /* private mode: shown once per page load instead */
      }
      setOpen(true);
      void markLeadPopupShown(token);
    }, LEAD_OFFER_DELAY_MS);
    return () => clearTimeout(t);
  }, [alreadyShown, key, token]);

  // Every download reopens the offer, after the file save has started.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onDownload = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        try {
          localStorage.setItem(key, "1");
        } catch {
          /* private mode */
        }
        setOpen(true);
        void markLeadPopupShown(token, "download");
      }, LEAD_OFFER_AFTER_DOWNLOAD_MS);
    };
    window.addEventListener(LEAD_OFFER_OPEN_EVENT, onDownload);
    return () => {
      clearTimeout(t);
      window.removeEventListener(LEAD_OFFER_OPEN_EVENT, onDownload);
    };
  }, [key, token]);

  return (
    <Dialog isOpen={open} onOpenChange={setOpen} title={`${owner.firstName} left you ${LEAD_OFFER_CREDITS} free credits`} hideTitle size="md">
      <div className="flex flex-col items-center gap-6 px-2 pb-2 pt-1 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1.5 text-body-2-medium text-accent-700 dark:bg-accent-950 dark:text-accent-300">
          <RiGiftLine className="size-4" aria-hidden />
          {LEAD_OFFER_CREDITS} free credits
        </span>

        <OwnerPortrait owner={owner} size={96} />

        <div className="flex flex-col gap-2">
          <p className="text-title-1-medium text-text-primary">
            {owner.firstName} left you {LEAD_OFFER_CREDITS} free credits!
          </p>
          <p className="mx-auto max-w-[300px] text-body-regular text-text-secondary">Use your free credits to test Preb on more candidates.</p>
        </div>

        <div className="flex w-full flex-col items-center gap-3">
          <ButtonLink href={leadGoPath(token, "offer")} className="w-full justify-center">
            Use your free credits
          </ButtonLink>
          <p className="text-body-2-regular text-text-secondary">No card or subscription needed</p>
        </div>
      </div>
    </Dialog>
  );
}
