"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { RiErrorWarningLine } from "@remixicon/react";
import { Button, ButtonLink } from "@/components/base/buttons/button";
import { EmptyState } from "@/components/base/empty-state/empty-state";

/** Route-level error boundary for the signed-in app: the header stays, the page shows a retry card. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center py-10 animate-page-enter">
      <div className="w-full max-w-[480px] rounded-3xl border border-border-button-default bg-background-primary-default shadow-xs">
        <EmptyState
          icon={RiErrorWarningLine}
          title="Something went wrong"
          description={
            <>
              This page could not be loaded. Try again, or go back to your lists.
              {error.digest ? (
                <>
                  {" "}
                  <span className="text-text-tertiary" dir="ltr">
                    Ref {error.digest}
                  </span>
                </>
              ) : null}
            </>
          }
          actions={
            <>
              <ButtonLink href="/lists" variant="secondary">
                Your lists
              </ButtonLink>
              <Button onClick={() => retry()}>Try again</Button>
            </>
          }
        />
      </div>
    </div>
  );
}
