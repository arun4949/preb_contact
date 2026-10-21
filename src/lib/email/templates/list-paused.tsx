import { Button, Text } from "@react-email/components";
import { appUrl, EmailLayout, emailStyles } from "./layout";

export interface ListPausedProps {
  /** Recipient's first name; empty greets "Hi there". */
  firstName: string;
  listId: string;
  listName: string;
  processed: number;
  remaining: number;
  /** Where the "list page" link goes; defaults to the list page. */
  href?: string;
  /** Why it paused: no credits (default), the monthly overspend limit, or a failed overspend payment. */
  reason?: "credits" | "overspend_limit" | "overspend_payment";
}

export function ListPausedEmail({ firstName, listId, listName, processed, remaining, href, reason = "credits" }: ListPausedProps) {
  const n = (v: number) => v.toLocaleString("en-US");
  const preview =
    reason === "overspend_limit"
      ? `${listName} is paused because your monthly overspend limit is reached`
      : reason === "overspend_payment"
        ? `${listName} is paused because an overspend payment failed`
        : `${listName} is paused because your workspace is out of credits`;
  const why =
    reason === "overspend_limit"
      ? `reached your monthly overspend limit after ${n(processed)} contacts, so we paused it. ${n(remaining)} contacts are still waiting. Raise the limit or add credits and it picks up again automatically within a minute.`
      : reason === "overspend_payment"
        ? `could not continue beyond your balance after ${n(processed)} contacts because the last overspend payment failed, so we paused it. ${n(remaining)} contacts are still waiting. Once the payment goes through, it picks up again automatically within a minute.`
        : `ran out of credits after ${n(processed)} contacts, so we paused it. ${n(remaining)} contacts are still waiting. As soon as you add credits, it picks up again automatically within a minute.`;
  const cta = reason === "overspend_limit" ? { href: "/lists?settings=billing&overspend=1", label: "Raise limit" } : reason === "overspend_payment" ? { href: "/lists?settings=billing&overspend=1", label: "Fix payment" } : { href: "/lists?settings=billing&plan=1", label: "Buy credits" };
  return (
    <EmailLayout preview={preview}>
      <Text style={emailStyles.title}>Your list is paused</Text>
      <Text style={emailStyles.body}>
        Hi {firstName || "there"}, a quick heads up: your list <strong>{listName}</strong> {why}
      </Text>
      <Button href={appUrl(cta.href)} style={emailStyles.button}>
        {cta.label}
      </Button>
      <Text style={emailStyles.footnote}>
        Everything enriched so far is saved on the{" "}
        <a href={appUrl(href ?? `/lists/${listId}`)} style={{ color: "inherit" }}>
          list page
        </a>
        .
      </Text>
    </EmailLayout>
  );
}
