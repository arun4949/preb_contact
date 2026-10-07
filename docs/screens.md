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
- **Header** (sticky, 64 px, `border-b border-separator-border`): left Preb logo + wordmark (`public/logo.svg`, `public/logoName.svg`) · nav `tabs` underline variant with only **Lists** · right: `+ New list` primary pill `button`, `Credits` `dropdown` trigger (coin icon, red `status-dot` when balance < 10 %), bell `icon-button` (stretch goal), avatar `dropdown`.
- **Content width** max 1440 px, `px-6 lg:px-10`, `py-8`. Mobile (< 768): header shows logo, New list icon button, avatar; content `px-4`.
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
   - `ContactGauge` (180° arc): track `border-button-default`, valid `chart-1`, risky `chart-3`; center label `Contacts` + number count‑up.
   - metric rows (`gap-2`): `chip` percentage + label + count + small download icon: Valid emails · Risky emails · Mobile phones · Duplicates removed.
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
- "Enrichment level — choose what to add": three `checkbox-card`s in a row (stack on mobile): **Work email** (1 credit, "Verified business email") · **Personal email** (3 credits, "For reaching candidates directly; recruiting use only") · **Mobile phone** (10 credits, "Mobile numbers; landlines are free").
- Row: `Name this list` `input` (placeholder "e.g. Sales Directors in NYC") · `Rows to enrich` preset chips 500 · 1,000 · 2,500 · 5,000 + number `input` (default all).
- Estimate card: `Typically ~320 credits · up to 415` with `progress-bar` of balance; "You have 1,240 credits". If short: warning `banner` + `Buy credits` button (opens plan picker).
- Footer: `Start enrichment` primary right.

## 3 · List detail

**Header**: `breadcrumb` Lists › *List name* (editable on click) + status `chip`. Right: credits‑used pill (`chip`, coin icon, `368`), `Download` `dropdown` (All · Valid emails · Risky emails · Not found · CSV), overflow (Rename · Stop · Delete).

**Enriching state**
- Centered panel (max 720 px): `EnrichmentProgress` (forked `agent-progress`, controlled) with steps *Validating rows · Submitting to enrichment network · Finding emails · Verifying deliverability · Finding mobile numbers · Finalising*; big `128 / 415 contacts` count‑up `text-title-1-medium`; ETA "about 6 minutes left"; rotating `agent-thinking` shimmer messages ("Checking 20+ data sources…"). Line: "You can leave — we'll email you when it's done."
- Below: the results table (same as completed) filling row by row; rows without result show a subtle skeleton in the email/phone cells.

**Completed state** (`1015:31`)
- `stat-cards` ×4 (plain): Contacts · Valid emails (%) · Risky emails (%) · Mobile phones (%).
- Toolbar: search `input` ("Search 415 contacts…"), `Column settings` `dropdown` (checkbox rows, persisted), Download.
- Two columns ≥ 1024 px: left filter rail 260 px (`Filters` + `Reset`; **Email status** stacked bar + pills Valid/Risky/Not found with counts; **Phone status** Found/Not found; **Duplicates removed** n); right `DataTable`.
- Table columns: ☐ · Name (avatar initials + name, LinkedIn icon link) · Job title · Company (logo via provider `logo_url` fallback initial, domain link) · Location · Work email (`status-dot` success/warning/neutral + copy on hover) · Personal email · Phone (`chip` Mobile/Landline, copy) · extra passthrough columns (hidden by default).
- Footer: `415 contacts in total` · page size `select` 25/50/100 · `pagination`.
- Mobile: filters in a `sheet` (button "Filters"), table horizontal scroll with sticky Name column.

## 4 · Account dropdown (`1015:33`)
Header block: avatar, name `text-body-medium`, workspace `text-body-2-regular text-text-secondary`. Group: Settings · Billing. (Workspace switcher group if member of several.) Group: Help center · Share feedback. Divider. Log out.

## 5 · Credits dropdown (`1015:35`)
Title `Credit balance`. Row: coin icon, `1,240 available` right‑aligned, `progress-bar` vs plan amount, meta `200 credits expire Dec 1`. Footer link `Manage credits` → Settings › Billing. If trial: `chip` "Trial · 25 credits".

## 6 · Settings modal (`1015:37` for the Billing content)
BoardUI `settings-modal`, pages: **Profile** (avatar upload, full name, email read‑only) · **Workspace** (name; members `table`: avatar, name, email, role `select`, remove; invite row `input` + role `select` + `Send invite`; pending invites with Resend/Revoke) · **Billing** (plan card: plan name, credits/month, renewal date, `Change plan`; balance card with expiry schedule; buttons `Manage billing` → Stripe portal; ledger `table`: date, description, ±credits). Plan picker `dialog`: `segmented-control` Monthly/Annual, 7 plan rows with price, credits, "Choose" → Stripe Checkout.

## 7 · Auth & onboarding
- `/login`: centered `auth-card`, Preb logo, "Sign in to Preb", Google `social-button`, divider, email `input` + `Continue with email`. Verify state: "Check your inbox — we sent a sign‑in link to …", resend link. Footer Terms · Privacy.
- `/onboarding`: single card: full name, workspace name (prefilled from email domain), optional "What are you hiring for?" `select`. CTA `Create workspace`.
- `/invite/[token]`: "Leon invited you to *Indiepal Ventures*" → `Accept invite` (requires sign‑in with the invited email).

## 8 · System states
`loading.tsx` skeletons per route; `error.tsx` card with retry; `not-found.tsx`; toasts for every action result; offline banner if Realtime drops.
