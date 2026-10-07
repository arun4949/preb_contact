import { Button, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./layout";

export function MagicLinkEmail({ url }: { url: string }) {
  return (
    <EmailLayout preview="Your sign-in link for Preb">
      <Text style={emailStyles.title}>Sign in to Preb</Text>
      <Text style={emailStyles.body}>
        Click the button below to sign in. The link is valid for one hour and can only be used once.
      </Text>
      <Button href={url} style={emailStyles.button}>
        Sign in
      </Button>
      <Text style={emailStyles.footnote}>
        If you didn&apos;t request this email you can safely ignore it. Someone may have typed your address by mistake.
      </Text>
    </EmailLayout>
  );
}
