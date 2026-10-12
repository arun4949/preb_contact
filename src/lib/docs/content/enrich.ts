import type { DocsCollection } from "../types";

const UPDATED = "2026-10-12";

export const enrich: DocsCollection = {
  slug: "enrich",
  title: "Enrich single contacts",
  summary: "Look up a few people by hand, without preparing a spreadsheet.",
  articles: [
    {
      slug: "enrich-a-single-contact",
      title: "Find one person without a spreadsheet",
      summary: "The Enrich tab takes up to 25 people at a time and shows the results in a table you can download.",
      keywords: ["enrich tab", "single contact", "one person", "lookup", "manual", "linkedin url"],
      updated: UPDATED,
      related: ["enrich-tab-vs-list", "what-preb-finds", "how-credits-work"],
      blocks: [
        { type: "paragraph", text: "Use the **Enrich** tab in the top bar when you have a few names in front of you and want their contact details right now." },
        { type: "heading", text: "Step by step" },
        { type: "steps", items: [
          "Open **Enrich** in the top bar.",
          "Fill in one row per person. A **LinkedIn profile URL** is enough. Otherwise give **First name**, **Last name** and the **Company domain**, for example acme.com.",
          "Click **Add contact** for more rows, up to 25 at once. **Clear all** empties the form.",
          "Under **What to find**, pick Personal email, Mobile phone or Work email. The button at the bottom reads what it will do, for example \"Find personal email and mobile phone for 3 contacts\", together with the credit estimate.",
          "Click the button. Results appear in the **Enriched contacts** table below within a minute or two.",
        ] },
        { type: "callout", tone: "tip", text: "A LinkedIn URL gives the best match rate and brings job title, company and location along." },
        { type: "heading", text: "The results table" },
        { type: "paragraph", text: "The table keeps everything you looked up in this workspace, newest first, so you can come back to it later. Search it with the field above the table, copy an email or a phone with the copy button, and use **Download CSV** to get the whole table as a file." },
        { type: "callout", tone: "note", text: "The same rules as for lists apply: you only pay for results we find, and a person enriched in the last 90 days in your workspace is free again." },
      ],
    },
    {
      slug: "enrich-tab-vs-list",
      title: "When to use Enrich and when to upload a list",
      summary: "Both give the same data for the same credits. The difference is the amount of people and the download.",
      keywords: ["comparison", "difference", "list vs enrich", "bulk"],
      updated: UPDATED,
      related: ["enrich-a-single-contact", "first-list-in-five-minutes"],
      blocks: [
        { type: "table", columns: ["", "Enrich tab", "List"], rows: [
          ["Best for", "A handful of people, right now", "A spreadsheet of 10 to 10,000 people"],
          ["Input", "Typed by hand, up to 25 at a time", "A CSV or Excel file"],
          ["Your own columns", "No", "Kept and returned in the download"],
          ["Progress and email when done", "Results appear in the table", "Progress panel, notification and email"],
          ["Download", "One CSV of all your lookups", "One CSV per list, with segments"],
          ["Data and credits", "Identical", "Identical"],
        ] },
        { type: "paragraph", text: "A good habit: test a few people on the Enrich tab to see the quality for your market, then upload the full list." },
      ],
    },
  ],
};
