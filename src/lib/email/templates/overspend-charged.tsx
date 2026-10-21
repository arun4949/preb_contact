import { Button, Text } from "@react-email/components";
import { appUrl, EmailLayout, emailStyles } from "./layout";

export interface OverspendChargedProps {
  /** Recipient's first name; empty greets "Hi there". */
  firstName: string;
  workspaceName: string;
  credits: number;
  /** Formatted amount, e.g. "$45.04". */
  amount: string;
  /** Formatted per-credit rate, e.g. "$0.037". */
  rate: string;
  lists: { name: string; credits: number }[];
  /** Stripe hosted invoice page (PDF download). */
  invoiceUrl: string | null;
}

/** Receipt for an overspend invoice that was charged to the payment method. */
export function OverspendChargedEmail({ firstName, workspaceName, credits, amount, rate, lists, invoiceUrl }: OverspendChargedProps) {
  const n = (v: number) => v.toLocaleString("en-US");
  return (
    <EmailLayout preview={`${amount} charged for ${n(credits)} credits beyond your balance`}>
      <Text style={emailStyles.title}>Your overspend was charged</Text>
      <Text style={emailStyles.body}>
        Hi {firstName || "there"}, your workspace <strong>{workspaceName}</strong> enriched {n(credits)} credits beyond its balance, as allowed by
        your overspend setting. We charged <strong>{amount}</strong> to your payment method at {rate} per credit.
      </Text>
      {lists.map((l) => (
        <Text key={l.name} style={emailStyles.footnote}>
          {l.name}: {n(l.credits)} {l.credits === 1 ? "credit" : "credits"}
        </Text>
      ))}
      <Button href={invoiceUrl ?? appUrl("/lists?settings=billing&overspend=1")} style={emailStyles.button}>
        {invoiceUrl ? "View invoice" : "Open billing"}
      </Button>
      <Text style={emailStyles.footnote}>You can change the monthly limit or turn overspend off any time under Settings › Billing.</Text>
    </EmailLayout>
  );
}
