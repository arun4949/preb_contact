import { Button, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./layout";

export function MagicLinkEmail({ url }: { url: string }) {
  return (
    <EmailLayout preview="Your sign-in link for Preb">
      <Text style={emailStyles.title}>Sign in to Preb</Text>
      <Text style={emailStyles.body}>Hi there, here is your personal sign-in link. It works once and stays valid for one hour.</Text>
      <Button href={url} style={emailStyles.button}>
        Sign in
      </Button>
      <Text style={emailStyles.footnote}>If you didn&apos;t ask for this link, you can simply ignore this email.</Text>
    </EmailLayout>
  );
}
