import type { DocsCollection } from "../types";

const UPDATED = "2026-10-12";

export const workspace: DocsCollection = {
  slug: "workspace",
  title: "Workspace and account",
  summary: "Teammates, roles, your profile, notifications and deleting things.",
  articles: [
    {
      slug: "invite-your-team",
      title: "Invite teammates",
      summary: "Add colleagues to your workspace so they share your lists and credits.",
      keywords: ["invite", "team", "members", "colleague", "add user", "pending invite"],
      updated: UPDATED,
      related: ["roles-and-permissions", "remove-a-member-or-leave", "create-your-workspace"],
      blocks: [
        { type: "steps", items: [
          "Open the account menu in the top right and click **Members**.",
          "Type the colleague's work email under **Invite a teammate** and choose **Member** or **Admin** as the role.",
          "Click **Send invite**. Your colleague receives an email with a link.",
        ] },
        { type: "paragraph", text: "Invites are valid for 7 days. Under **Pending invites** you can **Resend** an invite with a fresh link or **Revoke** it." },
        { type: "heading", text: "Accepting an invite" },
        { type: "paragraph", text: "The invited person clicks the link, signs in with the same email address the invite was sent to, and clicks **Accept invite**. If they are signed in with a different address, the page offers **Switch account**. Invited teammates skip the workspace setup and do not get a trial of their own, they use the workspace's credits." },
        { type: "callout", tone: "note", text: "Only owners and admins can invite teammates, change roles or manage invites." },
      ],
    },
    {
      slug: "roles-and-permissions",
      title: "Roles explained",
      summary: "What owners, admins and members can do in a workspace.",
      keywords: ["roles", "permissions", "owner", "admin", "member", "rights"],
      updated: UPDATED,
      related: ["invite-your-team", "remove-a-member-or-leave", "delete-workspace-or-account"],
      blocks: [
        { type: "paragraph", text: "Every workspace has exactly one owner, the person who created it. Owners and admins can promote a member to admin or an admin back to member. The owner's role cannot be changed." },
        { type: "table", columns: ["Can…", "Owner", "Admin", "Member"], rows: [
          ["Create lists and enrich contacts", "Yes", "Yes", "Yes"],
          ["See every list in the workspace", "Yes", "Yes", "Yes"],
          ["Delete any list", "Yes", "Yes", "Only their own"],
          ["Invite teammates, resend and revoke invites", "Yes", "Yes", "No"],
          ["Change roles and remove members", "Yes", "Yes", "No"],
          ["Choose or change the plan, open the billing portal", "Yes", "Yes", "No"],
          ["Turn overspend on or off and set its monthly limit", "Yes", "Yes", "No"],
          ["Leave the workspace", "No", "Yes", "Yes"],
          ["Delete the workspace", "Yes", "No", "No"],
        ] },
      ],
    },
    {
      slug: "profile-and-notifications",
      title: "Your profile and notifications",
      summary: "Your name, email and phone, the emails Preb sends, and the bell in the top bar.",
      keywords: ["profile", "settings", "name", "email", "phone", "notifications", "bell", "product news", "onboarding call"],
      updated: UPDATED,
      related: ["create-your-workspace", "running-out-of-credits"],
      blocks: [
        { type: "heading", text: "Profile" },
        { type: "paragraph", text: "Open the account menu in the top right and click **Settings**." },
        { type: "list", items: [
          "**Full name**, shown to your teammates and on the lists you create.",
          "**Email**, your sign-in address. It cannot be changed here, contact support if you need a new one.",
          "**Phone**, your direct line to our team for setup help and support. Never shown to teammates. Leave it empty to remove it.",
        ] },
        { type: "heading", text: "Emails and calls" },
        { type: "list", items: [
          "**Product news**, occasional updates about new features and tips. Switch it off if you prefer. Sign-in links and notices about your lists are always sent.",
          "**Onboarding call**, whether one of the founders may call you once to help with your setup. Only available when a phone number is stored.",
        ] },
        { type: "heading", text: "Emails Preb sends about your work" },
        { type: "list", items: [
          "A welcome email after you create a workspace.",
          "A sign-in link whenever you ask for one.",
          "An invite when a teammate adds you.",
          "A notice when a list is finished, and one when a list pauses because the credits ran out.",
          "A warning to the workspace owner when the balance drops under 10 percent of the plan.",
        ] },
        { type: "heading", text: "The bell" },
        { type: "paragraph", text: "The bell in the top bar collects the same events inside the app, with the tabs **All**, **Activity** and **Announcements**. Announcements are messages from the Preb team about new features or maintenance. **Mark all read** clears the counter." },
      ],
    },
    {
      slug: "remove-a-member-or-leave",
      title: "Remove a member or leave a workspace",
      summary: "What happens to lists and credits when someone leaves.",
      keywords: ["remove member", "leave workspace", "offboarding", "kick"],
      updated: UPDATED,
      related: ["roles-and-permissions", "invite-your-team", "delete-workspace-or-account"],
      blocks: [
        { type: "heading", text: "Remove a teammate" },
        { type: "steps", items: [
          "Open the account menu and click **Members**.",
          "Find the person in the list and click **Remove**.",
        ] },
        { type: "paragraph", text: "Owners and admins can remove members and admins. Nobody can remove the owner. The removed person loses access immediately. The lists they created stay in the workspace with their name on them, and the credits stay with the workspace." },
        { type: "heading", text: "Leave a workspace" },
        { type: "paragraph", text: "Under **Members**, click **Leave** next to your own name. Your lists stay behind for your teammates. If this was your only workspace, you are asked to create a new one at your next sign-in." },
        { type: "callout", tone: "note", text: "The owner cannot leave. To hand a workspace over, contact support and we transfer the ownership." },
      ],
    },
    {
      slug: "delete-workspace-or-account",
      title: "Delete your workspace or your account",
      summary: "Both are final. Here is exactly what is removed and in which order to do it.",
      keywords: ["delete account", "delete workspace", "close account", "remove data", "gdpr"],
      updated: UPDATED,
      related: ["data-privacy-and-retention", "invoices-and-payment", "roles-and-permissions"],
      blocks: [
        { type: "heading", text: "Delete the workspace" },
        { type: "paragraph", text: "Only the owner can do this." },
        { type: "steps", items: [
          "Download any list you still need.",
          "Open the account menu, click **Members** and scroll to **Delete workspace**.",
          "Type the workspace name to confirm and click **Delete workspace**.",
        ] },
        { type: "paragraph", text: "This removes every list, contact, uploaded file, stored result and credit. The subscription ends immediately, and used credits are not refunded. Teammates lose access at once." },
        { type: "heading", text: "Delete your account" },
        { type: "steps", items: [
          "Download anything you still need. Every workspace you own is deleted together with your account, including for your teammates. If a team should keep working in it, ask support to transfer the ownership first.",
          "Open the account menu, click **Settings** and scroll to **Delete account**.",
          "Type your email address to confirm and click **Delete account**.",
        ] },
        { type: "paragraph", text: "Your profile, phone number and sign-in are removed. In workspaces where you were a member, the lists you created pass to the workspace owner, because they belong to the workspace." },
        { type: "callout", tone: "important", text: "Deleting cannot be undone. Invoices are kept by our payment provider for as long as tax law requires." },
      ],
    },
  ],
};
