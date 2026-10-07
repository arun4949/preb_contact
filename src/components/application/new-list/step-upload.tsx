"use client";

import { useRef, type ComponentType } from "react";
import { RiBuilding2Line, RiChromeLine, RiFileAddLine, RiGroupLine, RiPlugLine, RiSearchEyeLine } from "@remixicon/react";
import { Chip } from "@/components/base/badges/chip";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { UploadDropZone } from "@/components/application/upload-drop-zone/upload-drop-zone";
import { useToast } from "@/components/base/toast/toast";
import { attachUpload, createDraftList } from "@/lib/lists/actions";
import { fileTypeFor } from "@/lib/csv/parse";
import { cx } from "@/utils/cx";
import { putToSignedUrl } from "./upload-client";
import type { UploadedFile } from "./new-list-wizard";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

const SOURCES: { icon: IconComponent; title: string; body: string }[] = [
  { icon: RiPlugLine, title: "Connect your CRM", body: "Import contacts from your ATS or CRM, then choose who to enrich." },
  { icon: RiChromeLine, title: "Browser extension", body: "Save candidates from professional networks with one click." },
  { icon: RiSearchEyeLine, title: "Prospect on Preb", body: "Search and build a targeted contact list in minutes." },
];

/** Step 1 (Figma 1015:39): Contacts/Companies toggle + 2×2 source cards, drop zone live. */
export function StepUpload({ onUploaded }: { onUploaded: (u: UploadedFile) => Promise<void> }) {
  const toast = useToast();
  const pendingUpload = useRef<UploadedFile | null>(null);

  const upload = async (file: File, onProgress: (p: number) => void) => {
    const fileType = fileTypeFor(file.name);
    if (!fileType) throw new Error("Only CSV and XLSX files are supported.");
    const [draft, bytes] = await Promise.all([createDraftList(file.name, file.size), file.arrayBuffer()]);
    if (!draft.ok) throw new Error(draft.error);
    await putToSignedUrl(draft.data.signedUrl, file, onProgress);
    const attached = await attachUpload(draft.data.listId, draft.data.path);
    if (!attached.ok) throw new Error(attached.error);
    pendingUpload.current = { listId: draft.data.listId, file, fileType, bytes };
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <SegmentedControl aria-label="List type" defaultSelectedKeys={["contacts"]}>
        <SegmentedControlItem id="contacts" className="gap-1.5">
          <RiGroupLine className="size-4" aria-hidden />
          Contacts
        </SegmentedControlItem>
        <SegmentedControlItem id="companies" isDisabled className="gap-1.5">
          <RiBuilding2Line className="size-4" aria-hidden />
          Companies
          <Chip variant="caption" color="soft" className="ms-1">
            Soon
          </Chip>
        </SegmentedControlItem>
      </SegmentedControl>

      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
        <section className="flex flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-5 md:col-span-2 lg:col-span-1">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background-secondary-default text-foreground-icon-secondary">
              <RiFileAddLine className="size-5" aria-hidden />
            </span>
            <div className="flex flex-col gap-0.5">
              <h2 className="text-headline-medium text-text-primary">Upload CSV / XLSX</h2>
              <p className="text-body-regular text-text-secondary">A spreadsheet with names and companies, LinkedIn URLs, or emails.</p>
            </div>
          </div>
          <UploadDropZone
            upload={upload}
            onUploadComplete={() => {
              const u = pendingUpload.current;
              if (u) {
                pendingUpload.current = null;
                void onUploaded(u).catch(() => toast.error("Could not read the file. Please try another export."));
              }
            }}
          />
          <p className="text-body-2-regular text-text-tertiary">
            Need a starting point?{" "}
            <a href="/samples/contacts-template.csv" download className="text-accent-600 underline-offset-2 hover:underline">
              Download the sample CSV
            </a>
            .
          </p>
        </section>

        {SOURCES.map(({ icon: Icon, title, body }) => (
          <section
            key={title}
            className={cx(
              "relative flex flex-col gap-3 rounded-3xl border border-border-button-default bg-background-primary-default p-5 opacity-70",
              "lg:col-span-1",
            )}
          >
            <Chip variant="caption" color="soft" className="absolute end-4 top-4">
              Coming soon
            </Chip>
            <span className="flex size-10 items-center justify-center rounded-full bg-background-secondary-default text-foreground-icon-secondary">
              <Icon className="size-5" aria-hidden />
            </span>
            <div className="flex flex-col gap-0.5">
              <h2 className="text-headline-medium text-text-primary">{title}</h2>
              <p className="text-body-regular text-text-secondary">{body}</p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
