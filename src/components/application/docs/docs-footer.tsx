import Link from "next/link";
import { CookiePreferencesLink } from "@/components/foundations/termly/termly-cmp";
import { CONTACT_PATH } from "@/lib/docs/registry";
import { LEGAL_URLS, MARKETING_SITE_URL } from "@/lib/site-links";

const LINK = "rounded-sm outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring";

export function DocsFooter() {
  return (
    <footer className="border-t border-separator-border">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-6 text-caption-1-regular text-text-secondary md:px-6 lg:px-10">
        <span>Preb, recruiting data enrichment.</span>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-4">
          <a href={MARKETING_SITE_URL} className={LINK}>
            Website
          </a>
          <Link href={CONTACT_PATH} className={LINK}>
            Contact
          </Link>
          <a href={LEGAL_URLS.terms} target="_blank" rel="noopener noreferrer" className={LINK}>
            Terms
          </a>
          <a href={LEGAL_URLS.privacy} target="_blank" rel="noopener noreferrer" className={LINK}>
            Privacy
          </a>
          <CookiePreferencesLink className={`cursor-pointer ${LINK}`} />
        </nav>
      </div>
    </footer>
  );
}
