import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./layout";

/** Sent right after the confirmation: what happened and what still waits for a founder. */
export function OptOutDoneEmail({ hint, pendingReview }: { hint: string; pendingReview: number }) {
  return (
    <EmailLayout preview="We will not look up this address again.">
      <Text style={emailStyles.title}>Your request is confirmed</Text>
      <Text style={pendingReview > 0 ? emailStyles.paragraph : emailStyles.body}>
        Hi there, {hint} is now on our suppression list. We deleted the results stored about this address in Preb and will not look it up again for any
        customer.
      </Text>
      {pendingReview > 0 ? (
        <Text style={emailStyles.body}>
          {pendingReview === 1 ? "The phone number or LinkedIn profile you added is" : "The phone number and LinkedIn profile you added are"} being
          checked by our team and will be added within 5 business days. You do not need to do anything else.
        </Text>
      ) : null}
      <Text style={emailStyles.footnote}>Questions? Reply to this email and a founder will answer.</Text>
    </EmailLayout>
  );
}
