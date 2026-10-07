import { Button, Text } from "@react-email/components";
import { appUrl, EmailLayout, emailStyles } from "./layout";

export interface ListFinishedProps {
  listId: string;
  listName: string;
  processed: number;
  validEmails: number;
  riskyEmails: number;
  mobiles: number;
  creditsUsed: number;
  stopped?: boolean;
}

export function ListFinishedEmail({ listId, listName, processed, validEmails, riskyEmails, mobiles, creditsUsed, stopped }: ListFinishedProps) {
  const n = (v: number) => v.toLocaleString("en-US");
  return (
    <EmailLayout preview={stopped ? `${listName} was stopped` : `${listName} is enriched`}>
      <Text style={emailStyles.title}>{stopped ? "Your list was stopped" : "Your list is enriched"}</Text>
      <Text style={emailStyles.body}>
        <strong>{listName}</strong> — {n(processed)} contacts processed: {n(validEmails)} valid emails, {n(riskyEmails)} risky, {n(mobiles)} mobile
        numbers. {n(creditsUsed)} credits used.
      </Text>
      <Button href={appUrl(`/lists/${listId}`)} style={emailStyles.button}>
        View list
      </Button>
      <Text style={emailStyles.footnote}>You can download the enriched list as CSV from the list page at any time.</Text>
    </EmailLayout>
  );
}
