import { Button, Text } from "@react-email/components";
import { appUrl, EmailLayout, emailStyles } from "./layout";

export interface ListPausedProps {
  listId: string;
  listName: string;
  processed: number;
  remaining: number;
}

export function ListPausedEmail({ listId, listName, processed, remaining }: ListPausedProps) {
  const n = (v: number) => v.toLocaleString("en-US");
  return (
    <EmailLayout preview={`${listName} is paused — your workspace is out of credits`}>
      <Text style={emailStyles.title}>Your list is paused</Text>
      <Text style={emailStyles.body}>
        <strong>{listName}</strong> ran out of credits after {n(processed)} contacts. {n(remaining)} contacts are waiting. Add credits and the
        list resumes automatically within a minute.
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
