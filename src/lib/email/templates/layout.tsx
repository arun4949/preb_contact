import type { ReactNode } from "react";
import { Body, Container, Head, Html, Img, Preview, Section, Text } from "@react-email/components";

/**
 * Shared chrome for every Preb email. Email clients ignore our CSS tokens, so
 * colours here are literal hex values that mirror the light theme.
 */
export const EMAIL_COLORS = {
  ground: "#f6f6f7",
  surface: "#ffffff",
  border: "#e6e6e9",
  text: "#111113",
  secondary: "#55555c",
  tertiary: "#8a8a93",
  accent: "#2563eb",
  white: "#ffffff",
} as const;

export const EMAIL_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif";

export function appUrl(path = "") {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://preb.co").replace(/\/$/, "");
  return `${base}${path}`;
}

/** Public URL for brand assets (uploaded by `scripts/upload-brand-assets.ts`). */
export function brandAssetUrl(name: string) {
  const explicit = process.env.EMAIL_ASSET_BASE_URL?.replace(/\/$/, "");
  if (explicit) return `${explicit}/${name}`;
  const supabase = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${supabase}/storage/v1/object/public/brand/${name}`;
}

export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: EMAIL_COLORS.ground, fontFamily: EMAIL_FONT, color: EMAIL_COLORS.text }}>
        <Container style={{ maxWidth: 480, margin: "0 auto", padding: "40px 16px" }}>
          <Section
            style={{
              backgroundColor: EMAIL_COLORS.surface,
              border: `1px solid ${EMAIL_COLORS.border}`,
              borderRadius: 24,
              padding: 32,
            }}
          >
            <Img src={brandAssetUrl("logoName.png")} alt="Preb" width={79} height={24} style={{ width: 79, height: 24, marginBottom: 24 }} />
            {children}
          </Section>
          <Text style={{ fontSize: 12, lineHeight: "18px", color: EMAIL_COLORS.tertiary, margin: "16px 0 0" }}>
            Preb · Recruiting data enrichment
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = {
  title: { fontSize: 20, fontWeight: 600, lineHeight: "28px", margin: "0 0 8px" },
  body: { fontSize: 14, lineHeight: "22px", color: EMAIL_COLORS.secondary, margin: "0 0 24px" },
  button: {
    display: "inline-block",
    backgroundColor: EMAIL_COLORS.accent,
    color: EMAIL_COLORS.white,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 500,
    lineHeight: "20px",
    padding: "10px 18px",
    borderRadius: 10,
  },
  footnote: { fontSize: 12, lineHeight: "18px", color: EMAIL_COLORS.tertiary, margin: "24px 0 0" },
} as const;
