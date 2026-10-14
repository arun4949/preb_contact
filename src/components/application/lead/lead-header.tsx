import { ButtonLink } from "@/components/base/buttons/button";
import { Chip } from "@/components/base/badges/chip";
import { ThemeToggle } from "@/components/application/theme/theme-toggle";
import { Logo, LogoName } from "@/components/foundations/brand/logo";
import { leadGoPath } from "@/lib/leads/constants";
import { MARKETING_SITE_URL } from "@/lib/site-links";

/**
 * Header of the lead share page: logo, theme, and only Sign in / Sign up.
 * Both buttons go through the `go` route (click logged, attribution cookie,
 * then /login). A signed-in admin sees a preview chip and a way back instead.
 */
export function LeadHeader({ token, isAdmin }: { token: string; isAdmin: boolean }) {
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
          {isAdmin ? (
            <>
              <Chip variant="caption" color="blue">
                Admin preview
              </Chip>
              <ButtonLink href="/admin/leads" variant="secondary" size="small">
                Back to leads
              </ButtonLink>
            </>
          ) : (
            <>
              <ButtonLink href={leadGoPath(token, "signin")} variant="secondary" size="small">
                Sign in
              </ButtonLink>
              <ButtonLink href={leadGoPath(token, "signup")} size="small">
                Sign up
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
