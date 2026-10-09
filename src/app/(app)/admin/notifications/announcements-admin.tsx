"use client";

import { useState } from "react";
import type { AnnouncementRecipients, AnnouncementRecord } from "@/lib/notifications/admin-actions";
import { fetchAnnouncementHistory } from "@/lib/notifications/admin-actions";
import { AnnouncementComposer } from "./announcement-composer";
import { AnnouncementHistory } from "./announcement-history";

/** Page shell: composer + live preview on top, sent announcements below. */
export function AnnouncementsAdmin({ recipients, history: initialHistory }: { recipients: AnnouncementRecipients; history: AnnouncementRecord[] }) {
  const [history, setHistory] = useState(initialHistory);

  return (
    <div className="flex flex-col gap-8 animate-page-enter">
      <div className="flex flex-col gap-1">
        <h1 className="text-title-2-medium text-text-primary">Announcements</h1>
        <p className="text-body-regular text-text-secondary">Push a message to the notification bell of every user, selected users or whole workspaces. Visible to Preb admins only.</p>
      </div>

      <AnnouncementComposer
        recipients={recipients}
        onSent={() => {
          void fetchAnnouncementHistory().then(setHistory);
        }}
      />

      <AnnouncementHistory history={history} />
    </div>
  );
}
