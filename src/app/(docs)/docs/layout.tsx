import type { Metadata } from "next";
import { DocsFooter } from "@/components/application/docs/docs-footer";
import { DocsShell } from "@/components/application/docs/docs-shell";
import { DOCS_NAV } from "@/lib/docs/registry";

export const metadata: Metadata = {
  title: { default: "Help center", template: "%s · Preb help" },
  description: "How to use Preb: upload a spreadsheet, find verified emails and mobile numbers, manage credits and your team.",
  openGraph: { siteName: "Preb", type: "website" },
};

/** Public help center. No session, no app header; the shell is its own. */
export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <DocsShell nav={DOCS_NAV}>{children}</DocsShell>
      <DocsFooter />
    </div>
  );
}
