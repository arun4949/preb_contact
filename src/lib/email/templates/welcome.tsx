import { Button, Text } from "@react-email/components";
import { CREDIT_COST } from "@/lib/fullenrich/mapping";
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
      <Text style={emailStyles.paragraph}>
        I&apos;m Arun, one of the founders of Preb. Thank you for signing up, it really means a lot to us.
      </Text>
      <Text style={emailStyles.body}>
        Your workspace <strong>{workspaceName}</strong> is ready
        {trialCredits > 0 ? `, and you have ${trialCredits} free credits to try it out` : ""}. Upload a CSV or XLSX of your candidates
        and Preb finds verified work emails, personal emails and mobile numbers within a few minutes. You only pay for what we find:{" "}
        {CREDIT_COST.work_email} credits per work email, {CREDIT_COST.personal_email} per personal email and {CREDIT_COST.mobile_phone} per
        mobile number.
      </Text>
      <Button href={appUrl("/lists/new")} style={emailStyles.button}>
        Enrich your first list
      </Button>
      <Text style={emailStyles.footnote}>
        If anything is unclear or you have feedback, just reply to this email. Our team reads every message.
      </Text>
    </EmailLayout>
  );
}
