import type { ReactNode } from "react";
import { Body, Column, Container, Head, Html, Img, Link, Preview, Row, Section, Text } from "@react-email/components";

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

/**
 * Every user email is written by and signed from Arun (Co-Founder). The
 * portrait is pre-cropped round with a transparent background because Outlook
 * ignores `border-radius` on images.
 */
export function FounderSignOff() {
  return (
    <Section style={{ marginTop: 32 }}>
      <Text style={{ fontSize: 14, lineHeight: "22px", color: EMAIL_COLORS.secondary, margin: "0 0 12px" }}>Best regards,</Text>
      <Row>
        <Column style={{ width: 60, verticalAlign: "middle" }}>
          <Img src={brandAssetUrl("portrait_arun_round.png")} alt="Arun" width={48} height={48} style={{ width: 48, height: 48, borderRadius: 24 }} />
        </Column>
        <Column style={{ verticalAlign: "middle" }}>
          <Text style={{ fontSize: 14, lineHeight: "20px", fontWeight: 600, color: EMAIL_COLORS.text, margin: 0 }}>Arun</Text>
          <Text style={{ fontSize: 13, lineHeight: "18px", color: EMAIL_COLORS.tertiary, margin: 0 }}>Co-Founder, Preb</Text>
        </Column>
      </Row>
    </Section>
  );
}

/** Deep link to Settings › Profile, where the product-news switch lives. */
export const EMAIL_PREFERENCES_PATH = "/lists?settings=profile";

export function EmailLayout({
  preview,
  children,
  signed = true,
  preferencesUrl,
}: {
  preview: string;
  children: ReactNode;
  signed?: boolean;
  /** Emails that count as product news link to the preference switch in the footer. */
  preferencesUrl?: string;
}) {
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
            {signed ? <FounderSignOff /> : null}
          </Section>
          <Text style={{ fontSize: 12, lineHeight: "18px", color: EMAIL_COLORS.tertiary, margin: "16px 0 0" }}>
            Preb · Recruiting data enrichment
            {preferencesUrl ? (
              <>
                {" · "}
                <Link href={preferencesUrl} style={{ color: EMAIL_COLORS.tertiary, textDecoration: "underline" }}>
                  Email preferences
                </Link>
              </>
            ) : null}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = {
  title: { fontSize: 20, fontWeight: 600, lineHeight: "28px", margin: "0 0 8px" },
  body: { fontSize: 14, lineHeight: "22px", color: EMAIL_COLORS.secondary, margin: "0 0 24px" },
  /** A paragraph followed by another paragraph rather than the button. */
  paragraph: { fontSize: 14, lineHeight: "22px", color: EMAIL_COLORS.secondary, margin: "0 0 12px" },
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
