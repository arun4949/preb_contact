import { LogoName } from "@/components/foundations/brand/logo";
import { CookiePreferencesLink } from "@/components/foundations/termly/termly-cmp";
import { LEGAL_URLS, MARKETING_SITE_URL } from "@/lib/site-links";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <a href={MARKETING_SITE_URL} className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring" aria-label="Preb website">
        <LogoName height={28} />
      </a>
      <main className="flex w-full flex-col items-center animate-page-enter">{children}</main>
      <footer className="flex items-center gap-4 text-caption-1-regular text-text-secondary">
        <a href={LEGAL_URLS.terms} target="_blank" rel="noopener noreferrer" className="hover:text-text-primary">Terms</a>
        <span aria-hidden>·</span>
        <a href={LEGAL_URLS.privacy} target="_blank" rel="noopener noreferrer" className="hover:text-text-primary">Privacy</a>
        <span aria-hidden>·</span>
        <CookiePreferencesLink className="cursor-pointer hover:text-text-primary" />
      </footer>
    </div>
  );
}
