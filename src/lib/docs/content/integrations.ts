import { CREDIT_COST } from "@/lib/fullenrich/mapping";
import { MCP_MAX_CONTACTS, publicMcpServerUrl } from "@/lib/mcp/config";
import type { DocsCollection } from "../types";

const UPDATED = "2026-11-02";
const URL = publicMcpServerUrl();
const MAX = MCP_MAX_CONTACTS.toLocaleString("en-US");

/**
 * AI assistants over MCP (Claude, ChatGPT, any MCP client). Written for
 * people who have never heard the word MCP: every step names the exact
 * button, the server address is `app.preb.co/mcp`, and the provider is never
 * named (registry test).
 */
export const integrations: DocsCollection = {
  slug: "integrations",
  title: "AI assistants and integrations",
  summary: "Use Preb from Claude, ChatGPT and other AI assistants, and what to do when a connection misbehaves.",
  articles: [
    {
      slug: "use-preb-in-your-ai-tool",
      title: "Use Preb inside your AI assistant",
      summary: "Connect Claude or ChatGPT once and ask for emails and mobile numbers in plain words. Same data, same credits as in the app.",
      keywords: ["mcp", "ai", "assistant", "claude", "chatgpt", "connector", "integration", "chat", "agent"],
      updated: UPDATED,
      related: ["connect-claude", "connect-chatgpt", "what-your-ai-tool-can-do"],
      blocks: [
        { type: "paragraph", text: "Preb can be a tool inside the AI assistant you already use. Once connected, you can write things like \"Find work emails for these 15 people\" or \"Who is behind jane@acme.com?\" and the assistant uses Preb to answer. Under the hood this is an open standard called MCP, but you never need to know that." },
        { type: "heading", text: "How it works in three steps" },
        { type: "steps", items: [
          `Add Preb in your assistant's connector settings by pasting one address: \`${URL}\`.`,
          "Sign in with your Preb account in the window that opens, choose the workspace the assistant may use and click **Allow**. No keys, no copying of secrets.",
          "Ask in plain words. The assistant shows you the cost before it spends anything and shows the results in the chat.",
        ] },
        { type: "paragraph", text: "The step-by-step guides are here: [Connect Claude](/docs/integrations/connect-claude), [Connect ChatGPT](/docs/integrations/connect-chatgpt) and [Connect other AI tools](/docs/integrations/connect-other-ai-tools). In the app, open **Integrations** in the top bar (on a phone: in the account menu) for the same address and example prompts." },
        { type: "heading", text: "What it costs" },
        { type: "paragraph", text: "Exactly the same as in the app: credits are spent only for results that are found, and a person enriched in your workspace in the last 90 days is free again. See [How credits work](/docs/billing/how-credits-work)." },
        { type: "callout", tone: "tip", text: "Make it a habit to say \"show me the cost first\". The assistant then checks the estimate with you and only starts after you confirm." },
        { type: "heading", text: "Where the results go" },
        { type: "paragraph", text: "Every run started from an assistant also appears in the **Enrich** tab of the workspace, marked with a small badge such as **via Claude**. You can search, copy and download it there like any other result." },
        { type: "heading", text: "Your data" },
        { type: "paragraph", text: "The assistant only receives what you ask it to look up and the results Preb returns. Preb does not read your chats. What the AI provider does with the conversation is governed by their terms, so use an assistant your company has approved for contact data. You can disconnect an assistant at any time under **Integrations**, see [Disconnect an assistant or fix a connection](/docs/integrations/disconnect-or-troubleshoot)." },
      ],
    },
    {
      slug: "connect-claude",
      title: "Connect Claude",
      summary: "Add Preb as a connector in Claude on the web or in the desktop app, in about two minutes.",
      keywords: ["claude", "anthropic", "connector", "custom connector", "claude desktop", "claude team"],
      updated: UPDATED,
      related: ["use-preb-in-your-ai-tool", "what-your-ai-tool-can-do", "disconnect-or-troubleshoot"],
      blocks: [
        { type: "heading", text: "What you need" },
        { type: "list", items: [
          "A Claude account. Custom connectors are available on the Free plan (one connector), on Pro and Max, and on Team and Enterprise plans, where an Owner adds the connector for the organisation.",
          "A Preb account. If you are not signed in yet, the connection window asks you to sign in first.",
        ] },
        { type: "heading", text: "Add Preb in Claude" },
        { type: "steps", items: [
          "Open Claude in the browser or the desktop app. In the bottom left, open your profile menu and click **Customize**, then **Connectors**.",
          "Click **Add custom connector**.",
          "Under **Name**, type Preb.",
          `Under **MCP server URL** (some accounts call it **Remote MCP server URL**), paste \`${URL}\`. Leave the advanced settings and the OAuth fields empty.`,
          "Click **Add**. Claude now shows Preb in the list with a **Connect** button.",
          "Click **Connect**. A Preb window opens. Sign in if asked, choose the workspace the assistant may use and click **Allow Claude to use Preb**.",
          "Back in Claude the connector shows as connected. If the window stays open, close it, Claude picks up the connection on its own.",
        ] },
        { type: "callout", tone: "note", text: "On a Team or Enterprise plan an Owner goes to **Organization settings**, then **Connectors**, clicks **Add**, chooses **Custom** and **Web**, and enters the same address. Every member then clicks **Connect** on the Preb connector under **Customize**, **Connectors**, and signs in with their own Preb account." },
        { type: "heading", text: "Use it in a chat" },
        { type: "steps", items: [
          "Start a new chat. Click the **+** button next to the message box and open **Connectors**.",
          "Turn **Preb** on for this chat. Claude remembers it for the conversation, but a brand new chat may need the switch again.",
          "Type a test: \"Check my Preb credits\". If Claude answers with your balance, everything works.",
        ] },
        { type: "paragraph", text: "The first time Claude uses a Preb tool in a chat it asks for permission. **Allow once** is fine for a test. For everyday work choose **Always allow** for the tools you trust, otherwise every lookup needs a click." },
        { type: "heading", text: "Troubleshooting" },
        { type: "list", items: [
          "**No Connectors menu.** You are on a Claude plan without custom connectors, or your organisation turned them off. Ask the person who manages Claude at your company.",
          "**The sign-in window opens but nothing happens afterwards.** Finish the sign-in, close the tab and go back to Claude. The connection completes on its own. A pop-up blocker can also keep the window from opening.",
          "**Claude says it cannot find Preb tools.** Open the **+** menu in the chat and make sure Preb is switched on for this conversation.",
          "**Claude asks you to sign in again.** The connection was disconnected in Preb or expired. Click **Connect** on the Preb connector once more.",
        ] },
        { type: "paragraph", text: "More help: [Disconnect an assistant or fix a connection](/docs/integrations/disconnect-or-troubleshoot)." },
      ],
    },
    {
      slug: "connect-chatgpt",
      title: "Connect ChatGPT",
      summary: "Add Preb as a custom MCP server in ChatGPT. Needs a paid plan with developer mode.",
      keywords: ["chatgpt", "openai", "developer mode", "custom mcp server", "connector", "plugin"],
      updated: UPDATED,
      related: ["use-preb-in-your-ai-tool", "what-your-ai-tool-can-do", "disconnect-or-troubleshoot"],
      blocks: [
        { type: "heading", text: "What you need" },
        { type: "list", items: [
          "A paid ChatGPT plan. Custom MCP servers are added in **Developer mode**, which the Free plan does not offer. On Business, Enterprise and Edu workspaces an admin may have to allow custom servers first, and OpenAI changes the plan rules from time to time, so if the option is missing, ask the person who manages ChatGPT at your company.",
          "ChatGPT in the browser or the desktop app.",
          "A Preb account.",
        ] },
        { type: "heading", text: "Add Preb in ChatGPT" },
        { type: "steps", items: [
          "Open ChatGPT, click your profile picture and open **Settings**.",
          "Find the connectors page. Depending on your version it is called **Connectors** or **Apps**, and sits under **Settings** or in the left sidebar under **Plugins**. Open its **Advanced** settings and turn on **Developer mode**.",
          "Click **Create** or **Add custom MCP server** (older versions: **Add connector**).",
          "Under **Name**, type Preb. A short description is optional, for example \"Verified emails and mobile numbers\".",
          `Under **MCP server URL**, paste \`${URL}\`.`,
          "Under **Authentication**, choose **OAuth**. Leave client ID and secret empty, ChatGPT registers itself.",
          "Read the warning about custom servers, tick **I understand** and click **Create**.",
          "A Preb window opens. Sign in if asked, choose the workspace the assistant may use and click **Allow ChatGPT to use Preb**.",
        ] },
        { type: "heading", text: "Use it in a chat" },
        { type: "steps", items: [
          "Start a new chat. Click the **+** button and look for Preb under **Connectors** or **Apps**, or simply mention it: \"Use Preb to find the work email of…\".",
          "Type a test: \"Check my Preb credits\". If ChatGPT answers with your balance, everything works.",
        ] },
        { type: "paragraph", text: "ChatGPT asks for a confirmation before a tool that spends credits runs. That is on purpose: read what it is about to do, then confirm." },
        { type: "heading", text: "Troubleshooting" },
        { type: "list", items: [
          "**There is no Developer mode.** Your plan or your workspace does not allow custom servers. Ask your ChatGPT admin, or use Claude, see [Connect Claude](/docs/integrations/connect-claude).",
          "**ChatGPT only offers search and fetch.** Some plans limit custom servers to looking things up. You can still search the people you already enriched; new enrichments need full access.",
          "**The sign-in window is stuck.** Finish the sign-in, close the tab and refresh ChatGPT. Check that pop-ups are allowed for chatgpt.com.",
          "**Two Preb entries.** You created the server twice. Remove the older one in the connectors settings, keep the one that is connected.",
        ] },
        { type: "paragraph", text: "More help: [Disconnect an assistant or fix a connection](/docs/integrations/disconnect-or-troubleshoot)." },
      ],
    },
    {
      slug: "connect-other-ai-tools",
      title: "Connect other AI tools",
      summary: "Claude Code, Cursor and any tool that speaks MCP can use the same address.",
      keywords: ["claude code", "cursor", "mcp client", "other tools", "config", "mcpServers", "command line"],
      updated: UPDATED,
      related: ["use-preb-in-your-ai-tool", "connect-claude", "what-your-ai-tool-can-do"],
      blocks: [
        { type: "paragraph", text: `Preb is a standard remote MCP server. Any tool that can add one by address works with it, and the sign-in is the same browser window as for Claude and ChatGPT. The address is always \`${URL}\`.` },
        { type: "heading", text: "Claude Code" },
        { type: "steps", items: [
          `In a terminal, run \`claude mcp add --transport http preb ${URL}\`.`,
          "Start Claude Code and type `/mcp`. Choose **preb** and **Authenticate**. Your browser opens the Preb sign-in, choose the workspace and click **Allow**.",
          "Ask Claude Code to \"check my Preb credits\" to confirm.",
        ] },
        { type: "heading", text: "Cursor, Windsurf and other editors" },
        { type: "paragraph", text: `In the tool's MCP settings add a server with the type **HTTP** (sometimes called **Streamable HTTP** or **Remote**), the name Preb and the address \`${URL}\`. Save, then click the sign-in or authenticate action the tool offers. If the tool asks for a configuration file, the entry looks like this: a server named preb, with the url set to the address above and no headers.` },
        { type: "callout", tone: "important", text: "Do not paste tokens, keys or passwords anywhere. Preb never needs them: the browser sign-in is the only credential, and you can revoke it under **Integrations** at any time." },
        { type: "heading", text: "Tools that cannot open a browser" },
        { type: "paragraph", text: "Some automation tools run on a server without a browser and cannot complete the sign-in. Preb does not offer API keys for them yet. Tell us what you want to connect through [Contact support](/docs/contact)." },
      ],
    },
    {
      slug: "what-your-ai-tool-can-do",
      title: "What your assistant can do with Preb",
      summary: "The actions Preb offers to an assistant, what they cost, example prompts and the limits.",
      keywords: ["tools", "capabilities", "prompts", "examples", "limits", "estimate", "credits", "reverse lookup"],
      updated: UPDATED,
      related: ["use-preb-in-your-ai-tool", "how-credits-work", "what-preb-finds"],
      blocks: [
        { type: "heading", text: "The actions" },
        { type: "table", columns: ["Ask for…", "What happens", "Credits"], rows: [
          ["Your balance", "The assistant reads the workspace's credits, plan and overspend setting.", "Free"],
          ["A cost estimate", "The assistant checks which people can be enriched, which ones are free because they were enriched in the last 90 days, and the typical and maximum credits.", "Free"],
          ["An enrichment", `Up to ${MAX} people per request. Give a LinkedIn URL, or first name, last name and company, or just an email address. The assistant starts the run, waits for the first results and shows them.`, `Per result found: work email ${CREDIT_COST.work_email}, personal email ${CREDIT_COST.personal_email}, mobile phone ${CREDIT_COST.mobile_phone}, identifying a person from an email ${CREDIT_COST.reverse}`],
          ["The results of a run", "Status, progress and the results so far of any run in the workspace, also for lists you uploaded in the app.", "Free"],
          ["Your recent runs", "The last runs with status, counts and credits used.", "Free"],
          ["A person you already enriched", "Searches the enriched contacts of the workspace by name, company or email and shows everything Preb found.", "Free"],
        ] },
        { type: "paragraph", text: "The assistant cannot change your plan, invite teammates, delete lists or read your uploaded files. It only sees the workspace you chose when you connected it." },
        { type: "heading", text: "Prompts that work well" },
        { type: "list", items: [
          "\"Here are 15 LinkedIn URLs. Find work emails and mobile numbers with Preb. Show me the cost first and wait for my go.\"",
          "\"How many Preb credits would it cost to find work emails for these people? Which of them were enriched before?\"",
          "\"Is my last Preb enrichment done? Show the results as a table with name, work email and mobile.\"",
          "\"Who is behind jane@acme.com? Use Preb to find her name, job title, company and LinkedIn profile.\"",
          "\"Enrich these 10 people with work emails through Preb, then draft a short, personal intro email for each one.\"",
        ] },
        { type: "callout", tone: "tip", text: "Paste a list straight from a spreadsheet. The assistant turns the lines into people for Preb. For more than a few hundred people, upload a list in the app instead, see [Your first list in five minutes](/docs/getting-started/first-list-in-five-minutes)." },
        { type: "heading", text: "Limits and timing" },
        { type: "list", items: [
          `At most ${MAX} people per request, and at most 10 runs per minute from one assistant.`,
          "Results take one to two minutes. The assistant shows what is ready and fetches the rest when you ask again.",
          "When the workspace runs out of credits, the run pauses like in the app and continues once credits are added or overspend is on, see [Running out of credits](/docs/billing/running-out-of-credits).",
          "Email levels are the same as in the app: Valid, Probably valid and Catch-all, see [Email statuses explained](/docs/data/email-statuses).",
        ] },
      ],
    },
    {
      slug: "disconnect-or-troubleshoot",
      title: "Disconnect an assistant or fix a connection",
      summary: "How to remove an assistant's access, and what to do when the connection or the sign-in does not work.",
      keywords: ["disconnect", "revoke", "remove", "troubleshooting", "sign-in failed", "expired", "not working", "401"],
      updated: UPDATED,
      related: ["use-preb-in-your-ai-tool", "connect-claude", "connect-chatgpt"],
      blocks: [
        { type: "heading", text: "Disconnect an assistant" },
        { type: "steps", items: [
          "Open **Integrations** in the top bar. On a phone, open the account menu in the top right and choose **Integrations**.",
          "On the card of the assistant, click **Disconnect** next to the workspace it uses, and confirm.",
          "Optional: remove Preb in the assistant's connector settings too. If you leave it, the assistant simply asks you to sign in again the next time.",
        ] },
        { type: "paragraph", text: "Disconnecting takes effect at once. Runs that already started finish normally, and their results stay in the Enrich tab." },
        { type: "heading", text: "The assistant says it is not signed in" },
        { type: "paragraph", text: "Someone disconnected the assistant in Preb, you were removed from the workspace, or the sign-in expired. Click **Connect** (Claude) or open the server's settings (ChatGPT) and sign in again." },
        { type: "heading", text: "The sign-in page says the request has expired" },
        { type: "paragraph", text: "The sign-in window waited too long, often because you were still signing in to Preb. Go back to the assistant and start the connection again, it only takes a moment the second time." },
        { type: "heading", text: "The approve page warns about an unknown app" },
        { type: "paragraph", text: "The page checks where it would send you back to. Claude and ChatGPT return to their own websites, so the warning does not appear for them. If you see it, only continue when you started the connection yourself a moment ago. If someone sent you the link, click **Cancel** and tell us." },
        { type: "heading", text: "The assistant uses the wrong workspace" },
        { type: "paragraph", text: "Each connection is tied to the workspace you picked when you clicked **Allow**. Disconnect it under **Integrations** and connect again, this time choosing the other workspace. If you need both, connect the assistant twice." },
        { type: "heading", text: "The assistant invents emails or numbers" },
        { type: "paragraph", text: "Preb only ever returns verified data, and tells the assistant clearly when something was not found. If an answer looks made up, ask the assistant to \"show the exact Preb result for this person\", or check the Enrich tab, which always shows the real data." },
        { type: "paragraph", text: "Still stuck? [Contact support](/docs/contact) and mention which assistant you use." },
      ],
    },
  ],
};
