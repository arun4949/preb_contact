import { Text } from "@react-email/components";
import { EMAIL_COLORS, EmailLayout, emailStyles } from "./layout";

export function OpsAlertEmail({ title, lines }: { title: string; lines: string[] }) {
  return (
    <EmailLayout preview={`Ops: ${title}`} signed={false}>
      <Text style={emailStyles.title}>{title}</Text>
      {lines.map((line, i) => (
        <Text key={i} style={{ ...emailStyles.body, margin: "0 0 8px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}>
          {line}
        </Text>
      ))}
      <Text style={{ ...emailStyles.footnote, color: EMAIL_COLORS.tertiary }}>Automated alert from the Preb enrichment engine.</Text>
    </EmailLayout>
  );
}
