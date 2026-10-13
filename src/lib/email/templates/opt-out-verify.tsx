import { Button, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./layout";

/** Sent from /opt-out: the person proves the address is theirs by opening the link. */
export function OptOutVerifyEmail({ url }: { url: string }) {
  return (
    <EmailLayout preview="One click confirms that this address is yours.">
      <Text style={emailStyles.title}>Confirm your request</Text>
      <Text style={emailStyles.body}>
        Hi there, you asked Preb to stop processing your contact details. Please confirm that this email address is yours. The link works once and stays
        valid for 24 hours.
      </Text>
      <Button href={url} style={emailStyles.button}>
        Confirm my request
      </Button>
      <Text style={emailStyles.footnote}>If you did not send this request, you can ignore this email. Nothing changes unless you confirm.</Text>
    </EmailLayout>
  );
}
