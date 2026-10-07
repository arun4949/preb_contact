import { Button, Text } from "@react-email/components";
import { appUrl, EmailLayout, emailStyles } from "./layout";

export interface WelcomeEmailProps {
  firstName: string;
  workspaceName: string;
  /** Trial credits granted at sign-up (0 when none). */
  trialCredits: number;
}

export function WelcomeEmail({ firstName, workspaceName, trialCredits }: WelcomeEmailProps) {
  return (
    <EmailLayout preview="Your Preb workspace is ready">
      <Text style={emailStyles.title}>Welcome to Preb{firstName ? `, ${firstName}` : ""}</Text>
      <Text style={emailStyles.body}>
        <strong>{workspaceName}</strong> is set up.
        {trialCredits > 0 ? ` You have ${trialCredits} free credits to try it out.` : ""} Upload a CSV or XLSX of candidates
        and Preb finds verified work emails, personal emails and mobile numbers in a few minutes. One credit per
        work email, three per personal email, ten per mobile number — you only pay for what we find.
      </Text>
      <Button href={appUrl("/lists/new")} style={emailStyles.button}>
        Enrich your first list
      </Button>
      <Text style={emailStyles.footnote}>
        Need help or have feedback? Reply to this email — it reaches the founders.
      </Text>
    </EmailLayout>
  );
}
