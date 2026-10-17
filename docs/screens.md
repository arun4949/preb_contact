# Screens & layout spec (Wiza reference → Preb)

Reference screenshots live in Figma file `Preb Playground` (key `1ubk4a4JolmKs8uOD3It3d`). Before building a screen, call the Figma MCP `get_screenshot` with the node id below (`maxDimension` 1600) and keep it open while coding. Copy the **layout and information architecture**, not Wiza's colors or type — every visual comes from BoardUI tokens and composite type utilities (see `AGENTS.md`).

| Screen | Figma node | URL |
|---|---|---|
| Lists dashboard + header | `1015:30` | https://www.figma.com/design/1ubk4a4JolmKs8uOD3It3d/Preb-Playground?node-id=1015-30 |
| Enriched list view | `1015:31` | https://www.figma.com/design/1ubk4a4JolmKs8uOD3It3d/Preb-Playground?node-id=1015-31 |
| Account dropdown | `1015:33` | https://www.figma.com/design/1ubk4a4JolmKs8uOD3It3d/Preb-Playground?node-id=1015-33 |
| Credits dropdown | `1015:35` | https://www.figma.com/design/1ubk4a4JolmKs8uOD3It3d/Preb-Playground?node-id=1015-35 |
| Billing page | `1015:37` | https://www.figma.com/design/1ubk4a4JolmKs8uOD3It3d/Preb-Playground?node-id=1015-37 |
| New list · step 1 | `1015:39` | https://www.figma.com/design/1ubk4a4JolmKs8uOD3It3d/Preb-Playground?node-id=1015-39 |
| New list · step 2 | `1015:41` | https://www.figma.com/design/1ubk4a4JolmKs8uOD3It3d/Preb-Playground?node-id=1015-41 |
| New list · step 3 | `1015:43` | https://www.figma.com/design/1ubk4a4JolmKs8uOD3It3d/Preb-Playground?node-id=1015-43 |

## Global frame

- **Page ground** `bg-background-full`; content surfaces `bg-background-primary-default`.
- **Header** (sticky, 64 px, `border-b border-separator-border`): left Preb logo + wordmark (`public/logo.svg`, `public/logoName.svg`) · nav `tabs` underline variant **Lists · Enrich** (pages outside them, e.g. `/admin/*`, select no tab: same items as plain links, no underline) · right: `+ New list` primary pill `button`, **bell** (BoardUI Finance template recipe: secondary `icon-button` 36 px with `RiNotificationLine`, red 16 px count dot `bg-foreground-icon-error` top-end, "9+" cap; opens § 9), `Credits` `dropdown` trigger (coin icon, red `status-dot` when balance < 10 %; below `sm` the coin only), avatar `dropdown`.
- **Content width** max 1440 px, `px-6 lg:px-10`, `py-8`. Mobile (< 768): header shows logo mark, both tabs, New list icon button, bell, coin, avatar; content `px-4`.
- **Cards/panels** `rounded-3xl border border-border-button-default bg-background-primary-default`. Controls `rounded-xl`. Pills `rounded-full`.
- **Type**: page title `text-title-2-medium`, section title `text-title-3-semibold`, card title `text-headline-medium`, body `text-body-regular`, secondary `text-body-regular text-text-secondary`, meta `text-body-2-regular text-text-tertiary`, labels `text-caption-1-semibold`.
- **Motion**: page/section enter 200 ms fade+4 px rise; card hover lift 1 px + border `-hover`; numbers count up (`use-count-up`); respect `prefers-reduced-motion`.
- **Feedback**: toasts via `notification` inside `NotificationViewport` (bottom‑end). Destructive actions confirm in `dialog`.
- **Dark mode** rides tokens; verify every screen in both.

## 1 · Lists dashboard (`1015:30`)

Layout top → bottom:
1. Page header row: gradient circle avatar (workspace), `Lists` + count `badge`, subtitle "Upload a spreadsheet and we find verified emails and phones." Right: `+ New list`.
2. Toolbar row (`gap-3`, wraps on mobile): status `select` (All · Enriching · Completed · Paused), owner `select` (Everyone · Me · member names), spacer, search `input` with leading icon, shortcut hint `kbd` `/`.
3. Grid `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6` of **ListCard**:
   - status strip (full‑width, `rounded-t-3xl`, `bg-background-secondary-default`): ✓ `Enriched Jun 29, 2026` · or `Enriching · 42 %` with `composer-loader` rim glow · or ⚠ `Paused — needs credits` · or `Stopped`. Right side: overflow `dropdown` (Rename · Stop (if running) · Delete).
   - title row: people icon, name `text-headline-medium`, chevron; whole card is a link to the list.
   - `ContactGauge` (180° segmented ring, 2026-10-12): one ring answers one question, the work-email outcome per enrichable contact. Valid `chart-1` and Catch-all `chart-8` segments with round ends and a 3° gap on a `chart-track` track; the grey remainder is "No email found". Shares use the same base as the percent chips (`enrichable_rows || total_rows`). Hovering a segment, the remainder, or a Valid/Catch-all row swaps the centre from `Contacts` + count‑up to the outcome's share as the big number with its name as the caption ("Valid emails" over "75%"; a share, never a count, so it cannot contradict the total when rows were skipped) and dims the other segments (BoardUI stacked-gauge recipe). Mobile phones overlap with emails and stay off the ring.
   - metric rows (`gap-2`): lead (legend swatch in the ring colour for Valid/Catch-all, phone icon for Mobile phones, icon for Duplicates removed) + label + neutral `chip` percentage (`soft`) + count: Mobile phones · Valid emails · Catch-all emails · Duplicates removed. Rows on the ring dim to 50 % while another outcome is focused; a row at 0 does not take focus, and an empty list (no enrichable rows) has no hover.
   - actions: `Download All (415)` secondary full‑width `button`.
   - skeleton variant (loading) and in‑progress variant (gauge animates a sweep, counts update live).
4. Empty state (`empty-state`): icon circle, "Create your first list", body, primary `New list`, secondary `Download sample CSV` (`/samples/contacts-template.csv`).

## 2 · New list wizard (`1015:39`, `1015:41`, `1015:43`)

Common: `stepper` (Upload · Map · Configure) under the header, page header with sparkle icon + title + subtitle, `Go back` secondary button right. Content centered, max 960 px. Step transitions slide 16 px with fade.

**Step 1 — Upload** (`1015:39`)
- `segmented-control` Contacts | Companies (Companies disabled, `chip` "Soon").
- 2×2 cards: **Upload CSV / XLSX** (active; contains `file-upload` drop zone, `allowedExtensions ["csv","xlsx"]`, 20 MB) · Connect your CRM · Browser extension · Prospect on Preb — the three disabled with "Coming soon" `chip`.
- After drop: real upload progress to Storage, then auto‑advance.

**Step 2 — Map your fields** (`1015:41`)
- `banner` info: "Map **names and company** (name or domain), **or LinkedIn profile URLs**, **or emails**."
- Two‑column list (`table`): CSV column `select` (prefilled by auto‑mapping; clearable) → Preb field label. Under each select: `e.g. Duff Ferguson` in `text-body-2-regular text-text-tertiary`.
- Preb fields: Full name · First name · Last name · Company · Domain · LinkedIn URL · Email · (any unmapped column = "Keep as extra column").
- Right/below summary card: `412 of 415 rows enrichable` · `3 rows missing required fields (view)` · `3 duplicates removed` · `12 already enriched (free)`. Toggle "First row contains headers".
- CTA `Next step` disabled until ≥1 row is enrichable.

**Step 3 — Configure** (`1015:43`)
- "Enrichment level — choose what to add": three `checkbox-card`s in a row (stack on mobile), personal first (website promise, 2026-10-09): **Personal email** (6 credits, "Direct reach · recruiting use only", preselected) · **Mobile phone** (20 credits, "Mobile numbers; landlines are free", preselected) · **Work email** (2 credits, "Verified business email, the fallback"). The Enrich tab uses the same order and defaults.
- Row: `Name this list` `input` (placeholder "e.g. Sales Directors in NYC") · `Rows to enrich` preset chips 500 · 1,000 · 2,500 · 5,000 + number `input` (default all).
- Estimate card: `Typically ~320 credits · up to 415` with `progress-bar` of balance; "You have 1,240 credits". If short: warning `banner` + `Buy credits` button (opens plan picker).
- Footer: `Start enrichment` primary right.

## 3 · List detail

**Header**: `breadcrumb` Lists › *List name* (editable on click) + status `chip`. Under the description a row of meta pills (contacts, credits used, duplicates removed, already enriched). Right: `Download` `dropdown` (All · Valid emails · Catch-all emails · Not found · CSV), overflow (Rename · Stop · Delete).

**Enriching state**
- Centered panel (max 720 px): `EnrichmentProgress` (forked `agent-progress`, controlled) with steps *Validating rows · Submitting to enrichment network · Finding emails · Verifying deliverability · Finding mobile numbers · Finalising*; big `128 / 415 contacts` count‑up `text-title-1-medium`; ETA "about 6 minutes left"; rotating `agent-thinking` shimmer messages ("Checking 20+ data sources…"). Line: "You can leave — we'll email you when it's done."
- Below: the results table (same as completed) filling row by row; rows without result show a subtle skeleton in the email/phone cells.

**Completed state** (`1015:31`)
- Summary cards (2026-10-17, `summary-cards.tsx`): one `rounded-3xl` card per ordered field (Work emails · Personal emails · Mobile phones, plus Identified for reverse lists): icon tile, label, `found / processed`, percent, a 56 px full ring (`summary-donut.tsx`, segments Valid `chart-1` · Probably valid `chart-2` · Catch-all `chart-8`, phones Mobile `chart-4` · other `chart-5`, remainder `chart-track`). Hovering the figure opens a `tooltip` panel: Deliverability (count + estimated bounce per level) or Connect rate (Highest/High/Medium/Not rated, ownership confirmed, line types). Work-email and phone ring segments are click-to-filter. A note under the card: "N catch-all emails revealed as probably valid" / "N numbers with confirmed ownership". Data from the SQL function `list_result_insights`.
- Toolbar: search `input` ("Search 415 contacts…"), `Column settings` `dropdown` (checkbox rows, persisted), Download.
- Filter chips in one wrapping row above the full-width table (`filter-chips.tsx`): **Work email** All · Valid · Probably valid · Catch-all · Not found (chart-colour swatch + count), **Phone** Found · Not found when ordered, ghost `Reset` at the end when a filter or search is active. No rail, no sheet. The table scrolls sideways with an always-visible slim scrollbar (`.bui-table-scroll`) and edge fades (`components/base/table/horizontal-scroll-edges.tsx`): one on the end edge while columns are hidden there, one after the sticky Name column once scrolled. Table cells: email + level marker (shield / check / question mark, tooltip with bounce estimate), phone + ownership marker (double check or mismatch, confidence) + connect-rate signal icon + Landline/VoIP chip, a counter badge listing every candidate when the record holds more than one (`status-markers.tsx`).
- Table columns: ☐ · Name (avatar initials + name, LinkedIn icon link) · Job title · Company (logo via provider `logo_url` fallback initial, domain link) · Location · Personal email (`status-dot` success/warning/neutral + copy on hover) · Phone (`chip` Mobile/Landline, copy) · Work email (same cell as personal) · extra passthrough columns (hidden by default). Personal data first everywhere (table, Enrich tab, CSV export `Preb:` columns, list-card metric rows); phones the provider reports as `INACTIVE` are dropped before they reach the record (`isUsablePhone`).
- Footer: `415 contacts in total` · page size `select` 25/50/100 · `pagination`.
- Mobile: filters in a `sheet` (button "Filters"), table horizontal scroll with sticky Name column.

## 4 · Account dropdown (`1015:33`)
Header block: avatar, name `text-body-medium`, workspace `text-body-2-regular text-text-secondary`. Group: Settings · Billing. (Workspace switcher group if member of several.) Group: Help center (→ `/docs`) · Contact support (messenger, also for feature ideas) · Cookie preferences. **Admin** group (only for `ADMIN_EMAILS`): Announcements → `/admin/notifications`, Ops → `/admin/ops`, Leads → `/admin/leads`, Suppressions → `/admin/suppressions`. Theme row. Divider. Log out.

## 5 · Credits dropdown (`1015:35`)
Title `Credit balance`. Row: coin icon, `1,240 available` right‑aligned, `progress-bar` vs plan amount, meta `200 credits expire Dec 1`. Footer link `Manage credits` → Settings › Billing. If trial: `chip` "Trial · 50 credits".

## 6 · Settings modal (`1015:37` for the Billing content)
BoardUI `settings-modal`, pages: **Profile** (avatar upload, full name, email read‑only, **Phone** row: `PhoneField` small, country `select` with flag and dial code inside the `input`, commits on Enter/blur, empty removes the number; section **Emails** › Product news `switch`; section **Calls** › Onboarding call `switch`, disabled with "Add a phone number above to allow a call." when no number is stored; section **Account** › Delete account) · **Workspace** (name; members `table`: avatar, name, email, role `select`, remove; invite row `input` + role `select` + `Send invite`; pending invites with Resend/Revoke) · **Billing** (plan card: plan name, credits/month, renewal date, `Change plan`; balance card with expiry schedule; buttons `Manage billing` → Stripe portal; ledger `table`: date, description, ±credits). Plan picker **view inside Billing** (no stacked dialog; `?settings=billing&plan=1`, title row gets a back arrow): `segmented-control` Monthly/Annual, slider over 11 tiers + "Contact us"; headline shows credits, $/month and $/credit; "Continue to checkout" → Stripe Checkout.

## 7 · Auth & onboarding
- `/login`: centered `auth-card`, Preb logo, "Sign in to Preb", Google `social-button`, divider, email `input` + `Continue with email`. Verify state: "Check your inbox — we sent a sign‑in link to …", resend link. Footer Help (→ `/docs`) · Terms · Privacy · Cookie preferences.
- `/onboarding`: single card: full name, workspace name (prefilled from email domain), optional **Phone number** (hint "Get a direct line to our team for setup help and faster support. Never shown to your teammates."; `PhoneField`: country `select` with flag and dial code as the input's leading addon, formats as you type, a pasted `+…` number switches the country, invalid numbers show "Enter a valid phone number for {Country}." and hold the submit). CTA `Create workspace`. Footer note: "We send occasional product news. If you add your number, we may call you once to help you get started. You can turn both off anytime in your profile settings."
- `/invite/[token]`: "Leon invited you to *Indiepal Ventures*" → `Accept invite` (requires sign‑in with the invited email).

## 8 · System states
`loading.tsx` skeletons per route; `error.tsx` card with retry; `not-found.tsx`; toasts for every action result; offline banner if Realtime drops.

## 9 · Notification center (header bell)
Popover 430 px (`dropdown`, `bottom end`, full width minus 32 px on phone) holding the forked `notification-center`: title `Notifications` + `N unread`, ghost `Mark all read`, `segmented-control` **All · Activity · Announcements** with unread counter pills, list on `bg-background-secondary-default` with day groups (Today · Yesterday · This week · Earlier, `text-caption-1-semibold text-text-tertiary`), rows `rounded-notification-card bg-background-primary-default` (visual circle: status/kind icon, or the Preb mark in `bg-accent-50` for announcements; title `text-body-medium` while unread, `text-body-regular` once read; body `text-body-2-regular` clamped to 3 lines; relative time `2m · 3h · Yesterday · Tue · Oct 2`; accent unread dot). Row click marks read and follows `href` (app path via router, `https://` in a new tab). Internal scroll region max 516 px with the top blur fade. Empty states per tab ("You're all caught up" / "No announcements yet"). Live: realtime INSERT → refetch → toast (one per burst, with View when the item has a link; "N new notifications" for several); refetch on tab focus.

## 10 · Admin announcements (`/admin/notifications`, admins only)
Page title `Announcements`; two cards on `lg`: **New announcement** (Title `input` 80 chars with counter, Message `textarea` 500 chars with counter, Link optional, Audience `segmented-control` All users · Selected users · Workspaces, picker = search `input` + `checkbox` rows with avatar/name/email/workspace chip, `N selected` + Clear; footer `Will reach N users.` or the validation message, primary `Send to N users` → `ConfirmDialog` (primary tone)) and **Preview** (the exact `NotificationRow` as users will see it). Below: **Sent announcements** `table` (title + body, audience chip, recipients, read count with %, sent, by) with an inline empty state.

## 11 · Help center (`/docs`, public)
Own shell in the `(docs)` route group, no app header, no session. **Header** (sticky, h‑16): logo + "/ Help center" → `/docs`, search `input` (small, hidden on the home page and below `md`), `/` `kbd` hint, `theme-toggle` segmented, `Open app` secondary button → `/lists`; phones get a hamburger and a search icon that both open a start‑side `sheet` with the search on top and the navigation below. **Sidebar** (from `lg`, sticky, `scroll-fade`): every collection with its icon and all its articles as links, current page `aria-current` on `bg-background-secondary-default`. **Home**: "How can we help?", medium search, 3‑up `rounded-3xl` collection cards (icon circle, title, summary, "N articles"), Popular articles, support card. **Collection**: breadcrumb, icon + title + summary, one card listing the articles with summaries and chevrons. **Article** (max 720 px, TOC rail "On this page" from `xl` with IntersectionObserver highlight): breadcrumb (Help center › Collection › Article), `text-display-4-semibold` title, summary, "Updated Oct 12, 2026", body from typed blocks (H2 with anchor, H3, paragraph, numbered steps with number bubbles, bullets, callouts Note / Tip / Important on the `banner` recipe, static `.bui-table`), "Was this article helpful?" Yes / No (thanks state, "Tell us what was missing" after No), Previous / Next cards, Related articles card, "Still need help?" support card (`Contact support` → messenger, "Other ways to reach us" → `/docs/contact`). **Search**: combobox + listbox under the field, title + collection `chip` + summary per hit, arrows / Enter / Escape, no‑hit state links to contact. **Contact** page: ways to reach us, what to include, feature ideas. **404** inside the shell: `empty-state` "Article not found" + search. **Footer**: Website · Contact · Terms · Privacy · Cookie preferences. Light and dark follow the tokens; copy never uses dashes as punctuation and never names the provider (enforced by `registry.test.ts`).

## 12 · Lead magnet (`/admin/leads`, admins only; `/l/<token>`, public)
**Admin overview** `/admin/leads`: title `Leads` + intro, primary pill `New lead enrichment`; six stat tiles (Active links · Opened · Unlocked · Downloads · Signed up · Credits spent); `segmented-control` **All · Mine**; `table` size sm: Lead (name, LinkedIn icon link, company · email), Owner (avatar + first name), Enrichment (status `chip` + `processed / enrichable · credits`), Stage `chip` (Not opened · Opened · Unlocked · Downloaded · Signed up · Revoked) with an engagement `tooltip` (timestamps, downloads, CTA clicks, who signed up), Link (link icon + "/l/" and the first 6 token characters, click copies the full URL with a toast), Code (mono, letter-spaced, click copies it with a toast), Created, Actions `dropdown` (Share: Copy link · Copy code · Copy chat message · Open page; Access: New code · New link · Revoke / Restore link; Delete → `ConfirmDialog`). `?list=<id>` from a notification highlights the row. **Create** `/admin/leads/new`: breadcrumb, three cards (The lead: Name, LinkedIn profile, Company, Email, Owner `select` of admin profiles; What to find: the three `checkbox-card`s; The profiles: `segmented-control` Paste · Upload, `textarea` with live `chip` count and rejected lines, or `upload-drop-zone`), `Create and enrich` → `Dialog` "Share with {lead}" with Link, Code and Chat message rows, each with a Copy button.
**Public page** `/l/<token>` (route group `(lead)`, no app header, `noindex`): sticky h‑16 header with logo → preb.co, `theme-toggle`, `Sign in` secondary + `Sign up` primary (admins see an `Admin preview` chip and `Back to leads`). **Gate**: 440 px card, owner portrait 72 px, "{Owner} prepared an enriched list for {lead}", `input-otp` with 4 boxes (submits on the last digit), inline error with tries left, locked copy with minutes. **List**: owner portrait 48 px, list name + status `chip`, "{Owner} enriched these contacts for you, {lead}…", contacts pill, Download `dropdown` (four segments, disabled until done); then the customer list view unchanged (summary cards or the enriching panel without Buy credits, toolbar, filter chips, table, pagination). **Popup** after 5 s, once per browser, and again 1.2 s after every download: `dialog` md, `50 free credits` pill with gift icon, 96 px portrait, `text-title-1-medium` "{Owner} left you 50 free credits!", body copy, full-width primary `Use your free credits`, caption `No card or subscription needed`. **Unavailable** state (unknown or revoked link): auth-style card "This link is no longer available" with `Open Preb`.

