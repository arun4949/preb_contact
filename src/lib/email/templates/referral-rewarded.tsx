import { Button, Text } from "@react-email/components";
import { appUrl, EmailLayout, emailStyles } from "./layout";

export interface ReferralRewardedProps {
  /** Recipient's first name; empty greets "Hi there". */
  firstName: string;
  credits: number;
  /** The friend's address in masked form, e.g. "j***@acme.com". */
  maskedEmail: string;
  workspaceName: string;
  /** ISO date the referral credits expire. */
  expiresAt: string;
}

/** Sent to the workspace owner when a referred friend's workspace paid its first invoice. */
export function ReferralRewardedEmail({ firstName, credits, maskedEmail, workspaceName, expiresAt }: ReferralRewardedProps) {
  const n = credits.toLocaleString("en-US");
  const until = new Date(expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return (
    <EmailLayout preview={`${n} credits were added to ${workspaceName}`}>
      <Text style={emailStyles.title}>You earned {n} credits</Text>
      <Text style={emailStyles.paragraph}>
        Hi {firstName || "there"}, a friend you invited to Preb ({maskedEmail}) just started a paid plan. As a thank you, we added{" "}
        <strong>{n} credits</strong> to your workspace <strong>{workspaceName}</strong>.
      </Text>
      <Text style={emailStyles.body}>The credits are valid until {until} and are used after any credits that expire earlier, so nothing of yours goes to waste.</Text>
      <Button href={appUrl("/lists?settings=referrals")} style={emailStyles.button}>
        Invite more friends
      </Button>
      <Text style={emailStyles.footnote}>Every friend who starts a paid plan within 90 days of signing up earns you credits once. The rules are in the help center under Invite friends.</Text>
    </EmailLayout>
  );
}
