import { ButtonLink } from "@/components/base/buttons/button";
import { ThemeToggle } from "@/components/application/theme/theme-toggle";
import { Logo, LogoName } from "@/components/foundations/brand/logo";
import { referralGoPath } from "@/lib/referrals/constants";
import { MARKETING_SITE_URL } from "@/lib/site-links";

/**
 * Header of the referral landing page: logo, theme, Sign in / Sign up. Both
 * buttons go through the `go` route (cookie, click count, then /login).
 * Without a code (unknown link) the buttons lead straight to /login.
 */
export function ReferralHeader({ code }: { code: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-separator-border bg-background-primary-default">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 md:px-6 lg:px-10">
        <a href={MARKETING_SITE_URL} aria-label="Preb website" className="flex shrink-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring">
          <span className="hidden items-center sm:flex">
            <LogoName height={24} />
          </span>
          <Logo size={28} className="sm:hidden" />
        </a>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle appearance="segmented" size="small" className="hidden sm:flex" />
          <ButtonLink href={code ? referralGoPath(code) : "/login"} variant="secondary" size="small">
            Sign in
          </ButtonLink>
          <ButtonLink href={code ? referralGoPath(code) : "/login"} size="small">
            Sign up
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
