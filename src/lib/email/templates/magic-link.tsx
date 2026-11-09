import { Button, Text } from "@react-email/components";
import { formatSignInCode } from "@/lib/auth/sign-in-code";
import { EMAIL_COLORS, EmailLayout, emailStyles } from "./layout";

const codeStyle = {
  fontFamily: "SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
  fontSize: 28,
  fontWeight: 600,
  lineHeight: "36px",
  letterSpacing: "4px",
  color: EMAIL_COLORS.text,
  margin: "0 0 24px",
} as const;

/**
 * Sign-in email: the one-time link and the code behind the same token. The code is for people who read the email on another device than the
 * one they are signing in on (a phone in the Meta or LinkedIn in-app browser
 * would otherwise lose the sign-in to Safari).
 */
export function MagicLinkEmail({ url, code }: { url: string; code: string }) {
  return (
    <EmailLayout preview={`${formatSignInCode(code)} is your Preb sign-in code`}>
      <Text style={emailStyles.title}>Sign in to Preb</Text>
      <Text style={emailStyles.paragraph}>Hi there, enter this code on the sign-in page to continue:</Text>
      <Text style={codeStyle} dir="ltr">
        {formatSignInCode(code)}
      </Text>
      <Text style={emailStyles.body}>Or click the button if you are reading this on the same device. Code and link work once and stay valid for one hour.</Text>
      <Button href={url} style={emailStyles.button}>
        Sign in
      </Button>
      <Text style={emailStyles.footnote}>If you didn&apos;t ask for this email, you can simply ignore it. Nobody can sign in without the code or the link.</Text>
    </EmailLayout>
  );
}
