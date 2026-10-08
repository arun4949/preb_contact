import { Button, Text } from "@react-email/components";
import { appUrl, EmailLayout, emailStyles } from "./layout";

export interface ListPausedProps {
  /** Recipient's first name; empty greets "Hi there". */
  firstName: string;
  listId: string;
  listName: string;
  processed: number;
  remaining: number;
}

export function ListPausedEmail({ firstName, listId, listName, processed, remaining }: ListPausedProps) {
  const n = (v: number) => v.toLocaleString("en-US");
  return (
    <EmailLayout preview={`${listName} is paused because your workspace is out of credits`}>
      <Text style={emailStyles.title}>Your list is paused</Text>
      <Text style={emailStyles.body}>
        Hi {firstName || "there"}, a quick heads up: your list <strong>{listName}</strong> ran out of credits after {n(processed)} contacts,
        so we paused it. {n(remaining)} contacts are still waiting. As soon as you add credits, it picks up again automatically within a
        minute.
      </Text>
      <Button href={appUrl("/lists?settings=billing")} style={emailStyles.button}>
        Buy credits
      </Button>
      <Text style={emailStyles.footnote}>
        Everything enriched so far is saved on the{" "}
        <a href={appUrl(`/lists/${listId}`)} style={{ color: "inherit" }}>
          list page
        </a>
        .
      </Text>
    </EmailLayout>
  );
}
