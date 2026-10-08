import { Button, Text } from "@react-email/components";
import { appUrl, EmailLayout, emailStyles } from "./layout";

export interface ListFinishedProps {
  /** Recipient's first name; empty greets "Hi there". */
  firstName: string;
  listId: string;
  listName: string;
  processed: number;
  validEmails: number;
  riskyEmails: number;
  mobiles: number;
  creditsUsed: number;
  stopped?: boolean;
}

export function ListFinishedEmail({ firstName, listId, listName, processed, validEmails, riskyEmails, mobiles, creditsUsed, stopped }: ListFinishedProps) {
  const n = (v: number) => v.toLocaleString("en-US");
  return (
    <EmailLayout preview={stopped ? `${listName} was stopped` : `${listName} is ready`}>
      <Text style={emailStyles.title}>{stopped ? "Your list was stopped" : "Your list is ready"}</Text>
      <Text style={emailStyles.body}>
        Hi {firstName || "there"}, {stopped ? "your list " : "good news: your list "}
        <strong>{listName}</strong> {stopped ? "was stopped as requested." : "is done."} We processed {n(processed)} contacts and found{" "}
        {n(validEmails)} valid emails, {n(riskyEmails)} risky emails and {n(mobiles)} mobile numbers, using {n(creditsUsed)} credits.
      </Text>
      <Button href={appUrl(`/lists/${listId}`)} style={emailStyles.button}>
        View list
      </Button>
      <Text style={emailStyles.footnote}>
        You can download the results as CSV from the list page at any time. If something looks off, just reply and we&apos;ll take a look.
      </Text>
    </EmailLayout>
  );
}
