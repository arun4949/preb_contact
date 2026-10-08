import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import "@/styles/globals.css";
import { Providers } from "./providers";
import { TermlyCMP } from "@/components/foundations/termly/termly-cmp";

/* Termly CMP website (shared with the old Preb app's Termly instance). */
const TERMLY_WEBSITE_UUID = "3c682d29-57d4-46b6-b071-9e88af258653";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Preb", template: "%s · Preb" },
  description: "Upload a spreadsheet and we find verified emails and phones.",
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

/* Applies the persisted theme before paint so there is no light flash. */
const THEME_SCRIPT = `try{if(localStorage.getItem("boardui:theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" dir="ltr" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col bg-background-full text-text-primary">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        <Providers>{children}</Providers>
        <Suspense fallback={null}>
          <TermlyCMP websiteUUID={TERMLY_WEBSITE_UUID} autoBlock />
        </Suspense>
      </body>
    </html>
  );
}
