import { Button, Text } from "@react-email/components";
import { appUrl, EmailLayout, emailStyles } from "./layout";

export interface CreditsLowProps {
  /** Recipient's first name; empty greets "Hi there". */
  firstName: string;
  workspaceName: string;
  available: number;
  planCredits: number;
}

export function CreditsLowEmail({ firstName, workspaceName, available, planCredits }: CreditsLowProps) {
  const n = (v: number) => v.toLocaleString("en-US");
  return (
    <EmailLayout preview={`${workspaceName} has ${n(available)} credits left`}>
      <Text style={emailStyles.title}>Your credits are running low</Text>
      <Text style={emailStyles.body}>
        Hi {firstName || "there"}, a quick heads up: your workspace <strong>{workspaceName}</strong> has {n(available)} of {n(planCredits)}{" "}
        credits left. When the balance reaches zero, running lists pause and pick up again as soon as new credits arrive.
      </Text>
      <Button href={appUrl("/lists?settings=billing&plan=1")} style={emailStyles.button}>
        Upgrade plan
      </Button>
      <Text style={emailStyles.footnote}>You can also manage your subscription under Settings › Billing.</Text>
    </EmailLayout>
  );
}
