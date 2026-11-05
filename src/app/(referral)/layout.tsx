import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "You're invited to Preb", template: "%s · Preb" },
  robots: { index: false, follow: false },
};

/**
 * Public referral landing pages (/r/<code>). No session needed, no app
 * header: the page renders its own header with Sign in / Sign up. The root
 * layout already provides the theme, direction and toast providers.
 */
export default function ReferralLayout({ children }: LayoutProps<"/">) {
  return <div className="flex min-h-dvh flex-col">{children}</div>;
}
