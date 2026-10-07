import { Button, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./layout";

export interface InviteEmailProps {
  url: string;
  inviterName: string;
  workspaceName: string;
  role: "admin" | "member";
}

export function InviteEmail({ url, inviterName, workspaceName, role }: InviteEmailProps) {
  return (
    <EmailLayout preview={`${inviterName} invited you to ${workspaceName} on Preb`}>
      <Text style={emailStyles.title}>Join {workspaceName} on Preb</Text>
      <Text style={emailStyles.body}>
        <strong>{inviterName}</strong> invited you to join <strong>{workspaceName}</strong> as {role === "admin" ? "an admin" : "a member"}.
        You&apos;ll share the workspace&apos;s contact lists and credits. Preb enriches candidate lists with verified work
        emails and mobile numbers.
      </Text>
      <Button href={url} style={emailStyles.button}>
        Accept invite
      </Button>
      <Text style={emailStyles.footnote}>
        The invite is valid for 7 days and only works with this email address. If you weren&apos;t expecting it you can ignore
        this message.
      </Text>
    </EmailLayout>
  );
}
