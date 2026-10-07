import { Button, Text } from "@react-email/components";
import { appUrl, EmailLayout, emailStyles } from "./layout";

export interface CreditsLowProps {
  workspaceName: string;
  available: number;
  planCredits: number;
}

export function CreditsLowEmail({ workspaceName, available, planCredits }: CreditsLowProps) {
  const n = (v: number) => v.toLocaleString("en-US");
  return (
    <EmailLayout preview={`${workspaceName} has ${n(available)} credits left`}>
      <Text style={emailStyles.title}>Your credits are running low</Text>
      <Text style={emailStyles.body}>
        <strong>{workspaceName}</strong> has {n(available)} of {n(planCredits)} credits left. Lists pause automatically when the balance hits
        zero and resume as soon as credits arrive.
      </Text>
      <Button href={appUrl("/lists?settings=billing&plan=1")} style={emailStyles.button}>
        Upgrade plan
      </Button>
      <Text style={emailStyles.footnote}>You can also manage your subscription from Settings › Billing.</Text>
    </EmailLayout>
  );
}
