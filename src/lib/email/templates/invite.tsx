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
      <Text style={emailStyles.title}>You&apos;re invited to {workspaceName}</Text>
      <Text style={emailStyles.paragraph}>
        Hi there, I&apos;m Arun, one of the founders of Preb. <strong>{inviterName}</strong> has invited you to join the workspace{" "}
        <strong>{workspaceName}</strong> as {role === "admin" ? "an admin" : "a member"}.
      </Text>
      <Text style={emailStyles.body}>
        Preb finds verified work emails and mobile numbers for candidate lists. Once you accept, you share the workspace&apos;s lists and
        credits with your team.
      </Text>
      <Button href={url} style={emailStyles.button}>
        Accept invite
      </Button>
      <Text style={emailStyles.footnote}>
        The invite is valid for 7 days and only works with this email address. If you weren&apos;t expecting it, you can ignore this email.
      </Text>
    </EmailLayout>
  );
}
