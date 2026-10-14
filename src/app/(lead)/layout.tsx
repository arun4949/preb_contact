import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Your enriched list", template: "%s · Preb" },
  robots: { index: false, follow: false },
};

/**
 * Public lead share pages (/l/<token>). No session, no app header: the page
 * renders its own header with Sign in / Sign up. The root layout already
 * provides the theme, direction and toast providers.
 */
export default function LeadLayout({ children }: LayoutProps<"/">) {
  return <div className="flex min-h-dvh flex-col">{children}</div>;
}
