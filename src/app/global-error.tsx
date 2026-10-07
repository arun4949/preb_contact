"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Last-resort boundary (root layout failed). Renders its own <html>, so it
 * can't use the app's components or stylesheet reliably — plain markup only.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Inter, system-ui, sans-serif", background: "#f6f6f7", color: "#111113" }}>
        <main style={{ maxWidth: 480, margin: "15vh auto", padding: 32, background: "#fff", border: "1px solid #e6e6e9", borderRadius: 24 }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Preb hit an unexpected error</h1>
          <p style={{ fontSize: 14, lineHeight: "22px", color: "#55555c", margin: "0 0 24px" }}>
            Reload the page. If it keeps happening, email support@preb.co{error.digest ? ` and mention ref ${error.digest}` : ""}.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ background: "#111113", color: "#fff", border: 0, borderRadius: 10, padding: "10px 18px", fontSize: 14, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
