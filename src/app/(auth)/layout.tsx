import Link from "next/link";
import { LogoName } from "@/components/foundations/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <Link href="/" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring" aria-label="Preb home">
        <LogoName height={28} />
      </Link>
      <main className="flex w-full flex-col items-center animate-page-enter">{children}</main>
      <footer className="flex items-center gap-4 text-caption-1-regular text-text-secondary">
        <a href="/terms" className="hover:text-text-primary">Terms</a>
        <span aria-hidden>·</span>
        <a href="/privacy" className="hover:text-text-primary">Privacy</a>
      </footer>
    </div>
  );
}
