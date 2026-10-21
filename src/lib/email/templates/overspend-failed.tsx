import { Button, Text } from "@react-email/components";
import { appUrl, EmailLayout, emailStyles } from "./layout";

export interface OverspendFailedProps {
  /** Recipient's first name; empty greets "Hi there". */
  firstName: string;
  workspaceName: string;
  credits: number;
  /** Formatted amount, e.g. "$45.04". */
  amount: string;
  /** The bank asks for a confirmation step (3-D Secure) rather than having declined. */
  actionRequired: boolean;
  /** Stripe hosted invoice page where the payment can be completed. */
  invoiceUrl: string | null;
}

/** An overspend invoice could not be charged: lists that need extra credits are paused until it is paid. */
export function OverspendFailedEmail({ firstName, workspaceName, credits, amount, actionRequired, invoiceUrl }: OverspendFailedProps) {
  const n = (v: number) => v.toLocaleString("en-US");
  return (
    <EmailLayout preview={actionRequired ? `Please confirm the ${amount} overspend payment` : `The ${amount} overspend payment failed`}>
      <Text style={emailStyles.title}>{actionRequired ? "Please confirm a payment" : "A payment did not go through"}</Text>
      <Text style={emailStyles.body}>
        Hi {firstName || "there"}, your workspace <strong>{workspaceName}</strong> enriched {n(credits)} credits beyond its balance.{" "}
        {actionRequired
          ? `Your bank asks you to confirm the ${amount} payment before it can be completed.`
          : `We could not charge ${amount} to your payment method.`}{" "}
        Lists that need extra credits are paused until the payment is done. Everything enriched so far is saved.
      </Text>
      <Button href={invoiceUrl ?? appUrl("/lists?settings=billing&overspend=1")} style={emailStyles.button}>
        {actionRequired ? "Confirm payment" : "Fix payment"}
      </Button>
      <Text style={emailStyles.footnote}>
        You can update your card under Settings › Billing, Manage billing, and retry the payment from the Overspend section.
      </Text>
    </EmailLayout>
  );
}
