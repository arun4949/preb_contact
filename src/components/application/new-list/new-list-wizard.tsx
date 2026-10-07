"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RiArrowLeftSLine, RiSparklingLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { Stepper } from "@/components/base/stepper/stepper";
import { useToast } from "@/components/base/toast/toast";
import { autoMap, type ColumnMapping } from "@/lib/csv/automap";
import type { ParsedSheet, FileType } from "@/lib/csv/parse";
import { discardDraft, type ParseSummary } from "@/lib/lists/actions";
import { cx } from "@/utils/cx";
import { StepUpload } from "./step-upload";
import { StepMap } from "./step-map";
import { StepConfigure } from "./step-configure";

const STEPS = [
  { id: "upload", label: "Upload" },
  { id: "map", label: "Map" },
  { id: "configure", label: "Configure" },
];

const TITLES = [
  { title: "Enrich your list", subtitle: "Build a list with verified contact info." },
  { title: "Map your fields", subtitle: "Tell us which columns hold names, companies, LinkedIn URLs or emails." },
  { title: "Configure", subtitle: "Choose what to find and how many rows to enrich." },
];

export interface UploadedFile {
  listId: string;
  file: File;
  fileType: FileType;
  bytes: ArrayBuffer;
}

/** Three-step wizard (Figma 1015:39/41/43). Step state lives here; steps are presentational + actions. */
export function NewListWizard({ creditsAvailable }: { creditsAvailable: number }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [upload, setUpload] = useState<UploadedFile | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [summary, setSummary] = useState<ParseSummary | null>(null);
  const parserRef = useRef<typeof import("@/lib/csv/parse") | null>(null);

  const loadParser = useCallback(async () => {
    if (!parserRef.current) parserRef.current = await import("@/lib/csv/parse");
    return parserRef.current;
  }, []);

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onUploaded = async (u: UploadedFile) => {
    const parser = await loadParser();
    const parsed = parser.parseSpreadsheet(u.fileType, u.bytes, true);
    if (parsed.rows.length === 0) {
      toast.error("The file has no data rows.");
      void discardDraft(u.listId);
      return;
    }
    setUpload(u);
    setHasHeader(true);
    setSheet(parsed);
    setMapping(autoMap(parsed.headers));
    if (parsed.truncated) toast.info("Only the first 10,000 rows will be used.");
    go(1);
  };

  const onToggleHeader = async (next: boolean) => {
    if (!upload) return;
    const parser = await loadParser();
    const parsed = parser.parseSpreadsheet(upload.fileType, upload.bytes, next);
    setHasHeader(next);
    setSheet(parsed);
    setMapping(next ? autoMap(parsed.headers) : mapping);
  };

  const back = () => {
    if (step === 0) {
      router.push("/lists");
      return;
    }
    if (step === 1) {
      if (upload) void discardDraft(upload.listId);
      setUpload(null);
      setSheet(null);
      setMapping(null);
      setSummary(null);
    }
    go(step - 1);
  };

  // Leaving mid-wizard: drop the draft so it never shows on the dashboard.
  const draftRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  useEffect(() => {
    draftRef.current = upload?.listId ?? null;
  }, [upload]);
  useEffect(() => {
    return () => {
      if (draftRef.current && !startedRef.current) void discardDraft(draftRef.current);
    };
  }, []);

  const { title, subtitle } = TITLES[step];

  return (
    <div className="flex flex-col gap-6 animate-page-enter">
      <Stepper steps={STEPS} current={step} className="self-center" />

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-separator-border pb-5">
        <div className="flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border-button-default bg-background-primary-default text-accent-600">
            <RiSparklingLine className="size-5" aria-hidden />
          </span>
          <div className="flex flex-col">
            <h1 className="text-title-2-medium text-text-primary">{title}</h1>
            <p className="text-body-regular text-text-secondary">{subtitle}</p>
          </div>
        </div>
        <Button variant="secondary" leadingIcon={RiArrowLeftSLine} onClick={back}>
          {step === 0 ? "Back to lists" : "Go back"}
        </Button>
      </div>

      <div key={step} className={cx("mx-auto w-full max-w-[960px]", dir === 1 ? "animate-step-forward" : "animate-step-back")}>
        {step === 0 ? <StepUpload onUploaded={onUploaded} /> : null}
        {step === 1 && upload && sheet && mapping ? (
          <StepMap
            listId={upload.listId}
            sheet={sheet}
            mapping={mapping}
            hasHeader={hasHeader}
            onMappingChange={setMapping}
            onHeaderChange={onToggleHeader}
            onParsed={(s) => {
              setSummary(s);
              go(2);
            }}
          />
        ) : null}
        {step === 2 && upload && summary ? (
          <StepConfigure
            listId={upload.listId}
            defaultName={upload.file.name.replace(/\.[^.]+$/, "")}
            summary={summary}
            creditsAvailable={creditsAvailable}
            onStarting={() => {
              startedRef.current = true;
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
