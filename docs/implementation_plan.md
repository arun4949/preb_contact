# Preb.co Recruiting Data Enrichment — MVP, 7‑day sprint plan (v2, reviewed)

## Context

Preb.co pivots from scheduling to recruiting data enrichment. Step 1 is an MVP that resells FullEnrich 1:1 behind a premium, Wiza‑style UI: upload a CSV → map columns → choose what to find → enrichment runs in the background → view, filter and download the enriched list. Workspaces with team members; credits and billing on workspace level through Stripe. One week, one developer + Claude Code, while the co‑founder builds the marketing site in Framer.

Repo today: near‑empty scaffold. Next.js 16.3 (App Router, `src/proxy.ts` instead of middleware, async request APIs, Turbopack), React 19, Tailwind v4, BoardUI initialised (theme/typography/`cx` present, only `Button` installed), Supabase SSR clients in `src/utils/supabase/{client,server,proxy}.ts`, remote Supabase project `zigocelujwbasujrozpk` with **zero tables/migrations**, logos in `public/`. `@/*` → `./src/*`. Not installed yet: `stripe`, `resend`, `papaparse`, `xlsx`, `@tanstack/react-table`, `server-only`.

Accounts to reuse: Stripe *Preb.co* (live, `acct_1TbKWFI8j3KU4u56`, old scheduling products only, EUR), Resend (preb.co verified), Google OAuth client from the old app.

## Decisions (CTO) and flags

**Decided**
1. **Billing = subscription tiers** mirroring FullEnrich Pro (monthly + annual), USD, Stripe Checkout; credits granted on `invoice.paid`, monthly grants expire +3 months, annual grants issued up front and expire +12 months; no overage.
2. **Trial = 25 credits, no card**, once per workspace; abuse guard (see Credits).
2a. **Work email required** (added day 2): magic link and Google sign‑up reject free‑mail and disposable domains (`src/lib/auth/work-email.ts`); exceptions = `ADMIN_EMAILS` and invited members (no trial anyway). Defense in depth: `public.is_free_email_domain()` and `handle_new_user` never grant a trial to a free‑mail domain (migration 0004).
3. **Enrichment fields mirror FullEnrich exactly**: work email (1 cr), personal email (3 cr), phone (10 cr for a mobile; landlines/VoIP returned free; no separate "private phone" exists). Plus **Reverse Email Lookup** (email → profile, 1 cr) as an input mode for email‑only rows. People/Company Search (prospecting) = post‑MVP.
4. **Hosting = Vercel, `preb.co`** (apex; changed from `app.preb.co` at go-live — no Framer site, the marketing site will be built in this app later); webhooks primary, 1‑minute cron safety net.

**Flags for you (answer any time; defaults in bold)**
- F1 **Hold sizing.** "Up to N credits" for all three fields = rows × 14, which blocks normal users (1,000 rows → 14,000 credits). Default: start requires `available ≥ expected cost` (find‑rate weighted: email 0.8, personal 0.4, mobile 0.5); dispatcher stops submitting when available ≤ 0 and the list pauses with a "Buy credits" CTA; **auto‑resumes** when credits arrive (better than FullEnrich, which never resumes). One batch of overdraft is possible; we absorb it.
- F2 **Cache reuse across workspaces.** Same contact already enriched by *another* workspace within 90 days: **serve from our cache and charge normally** (pure margin, no upstream call). Same workspace within 90 days: free (mirrors FullEnrich's 0‑credit dedup). Say if you prefer always re‑querying.
- F3 **XLSX upload**: recruiters live in Excel; FullEnrich accepts XLSX. **Included** (SheetJS, +2 h).
- F4 **Vercel Pro plan is required** for a 1‑minute cron (Hobby = daily). ~$20/seat/month.
- F5 **Reverse email mode** is scheduled last (day 7 morning) and is the first thing to cut if the week slips.
- F6 **Data retention**: we keep enriched data until the user deletes the list; FullEnrich keeps 3 months. Privacy policy (Leon) must say so; see M8.
- F7 **Currency USD** assumed for all Stripe prices.

**Things I questioned from your notes, resolved in the plan**
- "Billing only in the Stripe portal" → buying must start in‑app (Checkout) and management goes to the Portal; no card UI of our own. ✔
- BoardUI **Agent Progress is a timer demo** → forked into a controlled component fed by real progress. ✔
- BoardUI **data‑table is a demo component** (`DataTableExample`, hardcoded data) → forked into a generic server‑paginated table. ✔
- BoardUI has **no modal/dialog, toast API, drawer, empty state, skeleton, progress bar, stepper** → built once as base components following BoardUI's own patterns (see UI system). ✔
- Wiza layouts: **Figma + markdown together** (spec in `docs/screens.md` links each node; agent pulls screenshots via Figma MCP while building). Nothing to move. ✔
- **All email is ours, via Resend** (changed day 1): Supabase Auth never sends mail. Magic links are minted with `auth.admin.generateLink()` in our server action and delivered with a react‑email template through Resend; invites and every other notification likewise. No Supabase SMTP, no dashboard templates. Google SSO = add new callback URL to old client (manual, M1). ✔

## Product scope

**In:** magic link + Google sign‑in · onboarding (name, workspace name) · workspace auto‑created, invite members (owner/admin/member) · Lists dashboard · New list wizard (Upload CSV/XLSX → Map fields → Configure) · background enrichment (work/personal email, phone) · reverse email lookup for email‑only rows (day 7) · live progress · stop list · list detail table with filter rail, search, column settings, server pagination · CSV export (original columns + appended Preb columns; segments All/Valid/Risky/Not found) · credits (grants with expiry, holds, auto‑pause/resume) · Stripe Checkout + Customer Portal · Settings modal (Profile, Workspace & members, Billing) · emails (magic link, invite, list finished, list paused, credits low, ops alerts) · toasts · light/dark · responsive · delete list (hard delete).

**Out (sprint 2+):** CRM integrations, Chrome extension, Prospect/search, folders, companies enrichment, customer API keys, per‑user credit limits, SSO/SAML, notification center/bell (stretch), retry‑not‑found.

## UX/UI system (most important deliverable)

**Principles**: Wiza's information architecture, BoardUI's visual language. Calm surfaces, one accent, generous whitespace, 12–16 px radii on controls and `rounded-3xl` on cards, hairline borders, no drop‑shadow soup. Motion is purposeful: 150–250 ms ease‑out enters, layout animations via `motion`, count‑ups on numbers, shimmer only on real waiting. Skeletons, never spinners. Every state designed: empty, loading, in‑progress, paused, error, zero‑results. `prefers-reduced-motion` disables gauges/sweeps. Keyboard: `N` = new list, `/` = search, Esc closes. 44 px tap targets on mobile.

**Tokens/type only** (AGENTS.md): semantic color tokens, composite type utilities, `cx()`, Remix icons as component refs, react‑aria form components, `outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring`, logical properties, `DirectionProvider locale="en-US"`.

### BoardUI component map (install via MCP `install_components`)

| Need | BoardUI item | Notes from API review |
|---|---|---|
| Header tabs | `tabs` (underline) | MVP: "Lists" only; keep `Tabs` so more tabs drop in later. |
| Buttons/icon buttons | `button`, `icon-button`, `link-button`, `close-button` | — |
| Menus (account, credits, download, row actions) | `dropdown` (`Dropdown`, `DropdownTrigger`, `DropdownPopover`, `DropdownGroup`, `DropdownItem`, `DropdownDivider`) | Items don't auto‑close → call `setIsOpen(false)` in `onSelect`. Width via `className` on popover. |
| Inputs/selects | `input`, `select`, `checkbox`, `checkbox-card`, `radio-card`, `switch`, `switch-card`, `textarea` | `checkbox-card` for the three enrichment toggles (title + description + price chip). |
| Segmented toggles | `segmented-control` | Contacts/Companies, Monthly/Annual, Download segments. Read value as `[...keys][0]`. |
| Chips/badges/status | `chip`, `badge`, `status-dot`, `kbd` | Email status chips: Valid (success), Risky (warning), Not found (neutral). |
| Avatars | `avatar` | Initials fallback. |
| Breadcrumb, pagination, tooltip, divider | `breadcrumb`, `pagination`, `tooltip`, `divider` | — |
| Drop zone | `file-upload` | Props are `allowedExtensions={["csv","xlsx"]}`, `maxBytes`, `onUploadComplete(file)`. Its progress is simulated → fork `file-upload` to drive progress from the real Storage upload. |
| Table | `table` + `data-table` | `data-table` exports only `DataTableExample` → fork into `components/application/data-table/data-table.tsx` generic `<DataTable columns rows pageCount rowCount manualPagination manualSorting>` (TanStack `@tanstack/react-table`). Keep its density toggle, selection, `renderEmptyState`, `RowMoreMenu`. |
| KPI tiles | `stat-cards` (`variant="plain"`, `columns={4}`) | List detail summary: Contacts, Valid emails, Risky, Phones. Values are strings → pair with `use-count-up`. |
| Gauge on list card | **custom `ContactGauge`** (SVG) | `radial-chart-card` is a 329 px full card, wrong shape for a card thumbnail. Build a 180° gauge: track `var(--color-border-button-default)`, valid arc `chart-1`, risky `chart-3`, animated `pathLength` with `motion`, number via `useCountUp`. Reuse `formatNumber` from `charts/chart-card.tsx` if installed. |
| Toasts | `notification` + `NotificationViewport` | Purpose‑built toast stack (fixed, portal, animated). Write `ToastProvider` context with `toast.success/error()` that renders `<Notification autoDismissDuration onDismiss>`. |
| Notification bell (stretch) | `notification-center` | Tabs hardcoded → edit `TABS`. |
| Settings | `settings-modal` | Fork pages: replace `NAV_GROUPS`/`PAGE_TITLES`/`SettingsPage` with `profile | workspace | billing`; delete Tools/Storage/Marketplace/plan‑art files; reuse `SettingsCard`, `SettingsSectionLabel`, `SettingsRow`, `SettingsValueField` from `settings-rows.tsx`. |
| Auth | `auth-card`, `social-button` | `providers={["google"]}`, `mode="signin"` with email‑only form (hide password → fork minimal), `mode="verify"` style for "check your inbox". |
| Progress | `agent-progress` (fork → `EnrichmentProgress`) | Remove internal timers; props `steps`, `completedCount`, `activeProgress (0–1)`, `statusLabel`. Keep visuals. |
| Loading accents | `agent-thinking` (shimmer label), `composer-loader` (orbiting light rim) | `composer-loader` wraps the in‑progress list card's status strip for a premium "working" glow; `agent-thinking` shimmer on "Finding emails…" text. |
| Theme | `theme-toggle`, `direction`, `logo` (replace with Preb logo) | — |
| Hooks | `use-count-up`, `use-dismiss-on-outside-press` | — |

**Base components we must build (BoardUI‑style, in `src/components/base/`)**
- `dialog/dialog.tsx` — react‑aria `ModalOverlay/Modal/Dialog` (focus trap) styled like the Settings Modal overlay: backdrop `bg-black/70`, panel `rounded-3xl bg-background-full shadow-xs`, enter/exit `scale-[0.85] opacity-0 blur-[4px] → scale-100`, 300 ms `cubic-bezier(0.32,0.72,0,1)`. Variants: confirm (danger), form.
- `sheet/sheet.tsx` — side drawer for the filter rail on <1024 px (same recipe, translate‑x, RTL mirrored).
- `empty-state/empty-state.tsx` — icon circle `bg-background-secondary-default text-foreground-icon-secondary`, title `text-headline-medium`, body `text-body-regular text-text-secondary`, actions.
- `skeleton/skeleton.tsx` — `bg-background-secondary-default` shimmer blocks; card/table/row presets.
- `progress-bar/progress-bar.tsx` — track `bg-background-tertiary-default`, fill `bg-accent-600`, animated width.
- `stepper/stepper.tsx` — wizard steps (Upload · Map · Configure) with current/done states.
- `banner/banner.tsx` — inline info/warning/error (`border-border-error-default` etc.).

## Architecture

```
Browser (Next 16 App Router · BoardUI · Realtime on `lists` row only)
   │ server actions (mutations) · route handlers (webhooks, cron, export)
   ▼
Next.js on Vercel ──► Supabase (Postgres · Auth · Storage `list-uploads` · Realtime)
   ├─ POST /api/webhooks/fullenrich   HMAC‑SHA1 verify · idempotent · per‑contact + batch events
   ├─ POST /api/webhooks/stripe       signature verify · event.id idempotency · grants
   ├─ GET  /api/jobs/tick             Vercel Cron * * * * * · CRON_SECRET · dispatcher/reconciler/settler
   ├─ GET  /api/jobs/daily            expire grants · FullEnrich balance alert · cleanup
   └─ GET  /api/lists/[id]/export     streamed CSV, signed by session
                                           │
                                           ▼
                             FullEnrich API v2  https://app.fullenrich.com/api/v2
```

### FullEnrich integration (verified against docs, Oct 2026)
- Auth `Authorization: Bearer <key>`; **60 req/min fixed window across all endpoints incl. GETs**; 100 concurrent enrichments per workspace, rest queue upstream (never expire).
- `POST /contact/enrich/bulk?silentFail=true` ≤100 contacts: `{ name, webhook_url, webhook_events:{contact_finished}, data:[{ first_name,last_name,domain,company_name,linkedin_url, enrich_fields:[contact.work_emails|contact.personal_emails|contact.phones], custom:{contact_id,list_id,batch_id} }] }` → `{ enrichment_id }`. `custom` values strings, ≤10 keys, ≤100 chars.
- Minimum input: (`first_name`+`last_name`+(`domain`|`company_name`)) or `linkedin_url`.
- `GET /contact/enrich/bulk/{id}`: 200 when finished (`FINISHED|CREDITS_INSUFFICIENT|CANCELED`), **400 `error.enrichment.in_progress` while running**, 402 insufficient (partial data), 404 after 3 months; `?forceResults=true` for partial.
- Record: `input`, `custom`, `contact_info.{most_probable_work_email, most_probable_personal_email, most_probable_phone, work_emails[], personal_emails[], phones[]}`, `profile` (Person: headline, location, employment.current.title/company{name,domain,logo_url,industry,headcount_range}, educations, skills). **Only `most_probable_*` are billable/primary.** Email status `DELIVERABLE|HIGH_PROBABILITY|CATCH_ALL|INVALID|INVALID_DOMAIN`; phone `line_type MOBILE|LANDLINE|VOIP|UNKNOWN`, `line_status`, `connect_rate`, `ownership_match`.
- UI mapping: Valid = DELIVERABLE + HIGH_PROBABILITY · Risky = CATCH_ALL · Not found = none/INVALID. Phone "Mobile" chip when `line_type=MOBILE`, else "Landline" (free).
- Webhooks: body = GET payload; per‑contact events have one `data[]` item, status `IN_PROGRESS`. Header `X-Signature-SHA1` = hex HMAC‑SHA1(raw body, API key) → `timingSafeEqual` on `await req.text()` before parsing. Retries ×5 every minute on non‑2xx → idempotent by `(enrichment_id, contact_id, event_kind)`.
- Credits: work 1 (DELIVERABLE/HIGH_PROBABILITY/CATCH_ALL charged, INVALID free), personal 3, mobile 10, landline 0, not found 0, same input within 3 months 0; `cost.credits` per batch is authoritative. Per‑contact cost derived from the record (1/3/10 rules), reconciled to the batch total → delta logged as `adjust`.
- Reverse: `POST /contact/reverse/email/bulk?silentFail=true` `{ name, webhook_url, data:[{email, custom}] }` → same envelope with `profile`; 1 cr when identified.
- Our balance: `GET /account/credits` → `{balance}`; daily job alerts at <20% or < 2× largest in‑flight hold. `GET /account/keys/verify` on boot.
- Duration 40 s–2 min per contact, 100 in parallel → 1,000 rows ≈ 10–20 min. Zero‑credit E2E contact: `Grégoire Démogé · fullenrich.com · FullEnrich · https://www.linkedin.com/in/demoge/`.

### Credits & pricing
- 1 Preb credit = 1 FullEnrich credit, same consumption table (1 / 3 / 10 / reverse 1).
- **Grants, holds, ledger (expiry‑correct):** `credit_grants(amount, remaining, source, stripe_invoice_id unique, granted_at, expires_at)`; `consume_credits(ws, amount, list_id, batch_id)` drains **earliest‑expiry first** in one SQL function and writes one `credit_ledger` row per touched grant; `available = Σ remaining (expires_at > now) − Σ holds`. Daily job writes `expire` rows. A flat +/− ledger cannot expire partially used grants, so this structure is required.
- **Estimate shown**: "Typically ~M credits · up to N" (M = find‑rate weighted, N = max). Start requires `available ≥ M` (F1). Hold = M. Dispatcher checks `available > 0` before each batch; at ≤0 → list `paused_credits`, email + CTA; resumes on next tick after a grant. Settlement per batch: consume actual; hold released at list end.
- **Cache**: `enrichment_cache(input_hash, fields, result, provider, fetched_at)`; same‑workspace hit <90 d = free, "Already enriched" tooltip; cross‑workspace hit = served from cache, charged normally (F2).
- **Plans** (Stripe via MCP; test mode first; USD; price = FullEnrich × `MARGIN_MULTIPLIER`, start 1.15, final value chosen day 5; prices are then *fixed in Stripe*, the env var only drives display/estimates):

| Monthly | Credits/mo | FE $/mo | Annual | Credits/yr | FE $/mo billed yearly |
|---|---|---|---|---|---|
| Pro 500 | 500 | 29 | Pro 6k | 6,000 | 26 |
| Pro 750 | 750 | 42.75 | Pro 9k | 9,000 | 39 |
| Pro 1k | 1,000 | 55 | Pro 12k | 12,000 | 49 |
| Pro 1.5k | 1,500 | 79.50 | Pro 18k | 18,000 | 71 |
| Pro 2k | 2,000 | 104 | Pro 24k | 24,000 | 94 |
| Pro 5k | 5,000 | 255 | Pro 60k | 60,000 | 232 |
| Pro 10k | 10,000 | 499 | Pro 120k | 120,000 | 454 |
| larger | 15k/25k/50k/100k | 720/1,150/1,950/3,500 | larger | 180k…1.2M | 655…3,150 → "Contact us" |

- Stripe mechanics (day 5: plan switching is in-app, not in the Portal — Portal product limit is 10): Customer created lazily before first Checkout with `metadata.workspace_id`, `client_reference_id = workspace_id`; no `automatic_tax` (Kleinunternehmerregelung §19 UStG, CTO day 4; invoices carry the §19 note), billing address collected for invoices; grants on `invoice.paid` with `billing_reason ∈ {subscription_create, subscription_cycle}`; on `subscription_update` (upgrade) grant the credit *difference* from price metadata `credits`; `customer.subscription.deleted/updated` → store `plan_key`, `stripe_subscription_id`, `current_period_end` on `workspaces`; Portal allows switching among our prices and cancel at period end; idempotency by `event.id` in `webhook_events`; separate test/live endpoints, gate by `livemode`.
- **Trial**: 25 credits, expires +30 days, granted by the signup trigger only if no profile shares the Google `provider_id`/email and the email domain has <3 trials in 30 days; invited users joining an existing workspace get **no** workspace and no trial.

### Data model (Supabase `public`, RLS everywhere)

| Table | Key columns |
|---|---|
| `profiles` | `id=auth.users.id`, `full_name`, `avatar_url`, `default_workspace_id`, `onboarded_at`. Trigger `handle_new_user` (security definer, `search_path=''`) → profile; if pending invite for email → membership; else workspace + owner + trial. |
| `workspaces` | `id`, `name`, `slug`, `owner_id`, `stripe_customer_id`, `stripe_subscription_id`, `plan_key`, `current_period_end`, `trial_granted_at`. |
| `workspace_members` | `workspace_id`, `user_id`, `role owner|admin|member`, unique pair. |
| `workspace_invites` | `id`, `workspace_id`, `email`, `role`, `token_hash` (SHA‑256 of 32 random bytes), `invited_by`, `expires_at` (+7 d), `accepted_at`. |
| `credit_grants` / `credit_holds` / `credit_ledger` | as above; functions `credits_available(ws)`, `consume_credits(...)`, `expire_grants()`. |
| `lists` | `id`, `workspace_id`, `created_by`, `name`, `status draft|queued|enriching|paused_credits|paused_upstream|stopping|stopped|completed|failed`, `mode enrich|reverse`, `enrich_fields text[]`, `file_path`, `file_type`, `column_mapping jsonb`, counters `total_rows, enrichable_rows, submitted_rows, processed_rows, found_work_email, found_personal_email, found_phone, risky_email, not_found, duplicates_removed, cached_rows`, `credits_estimated`, `credits_used`, `started_at`, `completed_at`. Counters recomputed by trigger on `list_contacts` (idempotent). |
| `list_contacts` | `id`, `list_id`, `workspace_id`, `row_index`, `raw jsonb`, mapped `first_name,last_name,full_name,company_name,domain,linkedin_url,email_input`, `input_hash`, `status pending|cached|submitted|enriched|not_found|skipped|failed`, `skip_reason`, `work_email`, `work_email_status`, `personal_email`, `personal_email_status`, `phone`, `phone_meta jsonb`, `job_title`, `company`, `company_domain`, `location`, `profile jsonb`, `result jsonb`, `credits_cost`, `batch_id`, `enriched_at`. Indexes `(list_id,status)`, `(list_id,row_index)`, `(workspace_id,input_hash)`. |
| `enrichment_batches` | `id`, `list_id`, `workspace_id`, `kind enrich|reverse`, `provider_enrichment_id`, `status`, `contact_count`, `submitted_at`, `finished_at`, `credits_cost`, `last_polled_at`, `attempts`, `raw jsonb`. |
| `enrichment_cache` | `input_hash`, `fields text[]`, `result jsonb`, `provider`, `fetched_at`, `source_workspace_id`. |
| `provider_rate_limit` | single row token bucket: `window_start`, `count`. |
| `webhook_events` | `provider`, `external_id` unique, `payload`, `processed_at`, `error`. |

RLS: `is_workspace_member(ws)` + `is_workspace_admin(ws)` helpers; members read everything in their workspace; only owner/admin invite/remove/delete lists/manage billing; grants/holds/ledger/batches/cache/webhook_events writable by service role only. Storage bucket `list-uploads` private, path `${workspace_id}/${list_id}/original.ext`, RLS by prefix, signed upload URL for the client, server reads via service role. Realtime publication **only on `lists`**.

### CSV / XLSX ingest
- Client: `file-upload` → signed upload to Storage; PapaParse `preview: 200` for header detection + mapping preview (delimiter auto `, ; \t`, BOM strip, `TextDecoder` fallback Latin‑1); XLSX first sheet via SheetJS in a web worker for preview.
- Server action `parseList(listId)`: read file from Storage, full parse, normalise (trim headers; split "Full name" only when first/last absent; domain `strip scheme/www/path`; LinkedIn canonical `linkedin.com/in/<handle>` lowercase, Sales Navigator accepted; email lowercase), validate enrichability, within‑list dedup (same LinkedIn, else first+last+domain, else email) → `duplicates_removed`, cache lookup → `cached`, insert in 1,000‑row batches via `jsonb_to_recordset`. Caps: 10,000 rows, 20 MB, clear messages. Preview of invalid rows ("3 rows missing company") before start.
- Auto‑mapping heuristics table in `csv/automap.ts` (first_name|firstname|vorname…, etc.); user can map any unmapped column as **passthrough** (kept in export).
- Template `public/samples/contacts-template.csv` + download link in empty state and Step 1.

### Background processing
- `startList` action: validates, hold, `queued`, `after()` → `/api/jobs/tick`.
- `/api/jobs/tick` (cron + `after()`; `Authorization: Bearer CRON_SECRET`; `FOR UPDATE SKIP LOCKED`): (1) rate‑limit budget from `provider_rate_limit` (≤40 submits + ≤10 GETs per minute); (2) for `queued|enriching` lists with `available > 0`, batch ≤100 pending contacts (`kind` by mode), submit, mark `submitted`; (3) reconcile batches without webhook after 15 min (poll ≤1/10 min/batch); (4) settle finished batches (consume, adjust), finalise lists where no pending/submitted remain, release hold, send email; (5) on 429 stop for this run; on upstream 402 → `paused_upstream` + ops email.
- **Stop list**: `stopping` → no new submissions; in‑flight batches complete and settle → `stopped`. UI copy: "Contacts already in progress will finish and be charged." FullEnrich has no cancel API.
- Webhook handler: verify, store `webhook_events`, upsert contact result (`status`, fields, `credits_cost` derived), batch terminal → mark; counters via trigger; return 200 fast.

### Security
- `server-only` on `src/lib/supabase/admin.ts` (service role) and all `src/lib/**/server*.ts`; service client used only in `app/api/**` and server actions.
- `proxy.ts`: session refresh via `getClaims()`, redirect unauthenticated app routes to `/login?next=`, pass `/api/webhooks/*`, `/api/jobs/*`, `/auth/*` through untouched. Server actions re‑check `getUser()` + membership/role.
- Webhooks: raw body, signature, 401 on mismatch; cron secret; invite token hashed, single use, bound to invited email; rate‑limit invites (10/h/workspace); signed URLs 60 s for exports; no PII in logs.
- Run `get_advisors` (security, performance) before deploy; RLS tests with two workspaces.

### Observability & testing
- Sentry (`@sentry/nextjs`) server + client; structured logs `{list_id,batch_id,enrichment_id}` in tick/webhooks; `/admin/ops` page (allowlisted emails, service role) showing FullEnrich balance, stuck batches, failed webhooks, paused lists.
- Vitest: `csv/parse`, `csv/automap`, `fullenrich/mapping` (fixtures from docs payloads), `credits/estimate`, `fullenrich/signature`; SQL assertions for `consume_credits`/`expire_grants`; MSW mock of FullEnrich for engine tests; one Playwright smoke (login via test OTP, upload sample, progress, export).

## Screens (Wiza reference · Figma file `1ubk4a4JolmKs8uOD3It3d`)

Spec lives in `docs/screens.md`; agent calls `get_screenshot` per node while building.

| Screen | Node | Layout & components |
|---|---|---|
| App header | 1015‑30 | Sticky bar `bg-background-primary-default` + `border-separator-border`: Preb logo + wordmark · `tabs` (Lists) · right: **+ New list** (`button` primary, pill) · **Credits** (`dropdown`, coin icon, red dot when <10%) · bell (`icon-button`, stretch) · avatar `dropdown`. Mobile: logo, New list icon button, avatar. |
| Onboarding | — | After first login (no `onboarded_at`): centered `rounded-3xl` card, "Welcome to Preb" → full name, workspace name (prefilled from email domain), optional "hiring for" select; CTA "Create workspace". Invitees skip it. |
| Lists dashboard | 1015‑30 | Header: gradient avatar, "Lists" `text-title-2-medium` + count `badge`, subtitle; right New list. Toolbar: status `select` (All/Enriching/Completed/Paused), owner `select`, search `input` (⌘/). Grid 3→2→1 of **ListCard** `rounded-3xl border-border-button-default`: status strip (Enriched ✓ date · Enriching with `composer-loader` rim + % · Paused warning) · title + chevron · `ContactGauge` "Contacts N" count‑up · rows Valid emails % · Risky % · Phones % · Duplicates removed · **Download All (N)** `button secondary` · overflow `dropdown` (Rename, Stop, Delete → `dialog`). Empty state: `empty-state` with template download + "Create your first list". Skeleton cards while loading. |
| New list · Step 1 | 1015‑39 | `stepper` (Upload · Map · Configure). Header sparkle icon "Enrich your list". `segmented-control` Contacts / Companies (disabled "Soon"). 2×2 source cards: **Upload CSV/XLSX** with `file-upload` inline; CRM, Extension, Prospect disabled with "Coming soon" `chip`. Drop → upload progress → auto‑advance. |
| Step 2 | 1015‑41 | "Map your fields" + Go back. `banner` info: *names + company, or LinkedIn URL, or emails*. Mapping rows: CSV column (`select`, auto‑mapped) → Preb field; example value from row 1 in `text-body-2-regular text-text-tertiary`. Right summary card: enrichable rows, missing‑field rows, duplicates, cached. Toggle "First row contains headers". |
| Step 3 | 1015‑43 | "Configure". Three `checkbox-card`s: Work email (1 cr), Personal email (3 cr, note "recruiting use only"), Mobile phone (10 cr; landlines free). Reverse lookup info card if email‑only rows exist (day 7). List name `input`. Rows to enrich (default all; preset chips 500/1k/2.5k/5k + input). **Estimate card**: "Typically ~M credits · up to N · you have A" with `progress-bar`; if A<M → warning + **Buy credits** → Checkout. CTA **Start enrichment**. |
| List detail · enriching | — | `breadcrumb` Lists › name + status `chip` ("Enriching"), right: Stop (`button secondary` → `dialog`), Download disabled. Centered panel: `EnrichmentProgress` (forked AgentProgress, controlled) steps *Validating rows · Submitting to enrichment network · Finding emails · Verifying deliverability · Finding mobile numbers · Finalising*; large count‑up "128 / 415 contacts", ETA from avg batch time, rotating `agent-thinking` messages; "We'll email you when it's done". Table below refetches page every 5 s (debounced) while enriching — rows fill in. Realtime subscription only on the `lists` row. |
| List detail · done | 1015‑31 | Breadcrumb + "Enriched" chip; right: credits‑used pill, **Download** `dropdown` (All / Valid / Risky / Not found), overflow (Rename, Delete). `stat-cards` ×4. Search + Column settings (`dropdown` with `checkbox` rows, persisted per user in localStorage). Left rail (≥1024 px; `sheet` below): Email status (stacked bar + Valid/Risky/Not found pills), Phone status, Duplicates removed. `DataTable` server‑paginated (25/50/100): Name · Job title · Company (logo + domain link) · Location · Work email (`status-dot` + copy on hover) · Personal email · Phone (`chip` Mobile/Landline) · LinkedIn. Footer: total, page size `select`, `pagination`. Mobile: horizontal scroll, sticky first column. |
| Account dropdown | 1015‑33 | Avatar + name + workspace header; workspace switcher group if >1; Settings · Billing (open `settings-modal` pages); Help center · Share feedback · Log out. |
| Credits dropdown | 1015‑35 | "Credit balance": A available · `progress-bar` vs plan amount · "N expire on date" · Manage credits → Billing. |
| Settings modal | 1015‑37 | Pages **Profile** (name, avatar upload, email read‑only) · **Workspace** (name; members `table` with role `select`, remove → `dialog`; invite `input` + role + Send; pending invites with resend/revoke) · **Billing** (plan card, balance + expiry, buttons *Change plan* → plan picker `dialog` with `segmented-control` monthly/annual → Checkout; *Manage billing* → Portal; ledger `table`). |
| Auth | — | `/login`: `auth-card` with Google `social-button` + email magic link; "Check your inbox" state; footer Terms/Privacy. `/auth/confirm` (token hash), `/auth/callback` (PKCE), `/invite/[token]` (login redirect with `next`). |
| Errors | — | `not-found.tsx`, `error.tsx`, `loading.tsx` per route with skeletons; toasts for action results. |

## Repository layout

```
docs/product_mvp.md · docs/screens.md · docs/fullenrich.md · docs/setup_manual.md · docs/decisions.md
supabase/migrations/0001_schema.sql … (RLS, functions, triggers, realtime, storage bucket)
src/app/(auth)/login · (auth)/onboarding · auth/callback · auth/confirm · invite/[token]
src/app/(app)/layout.tsx (header, providers) · lists · lists/new · lists/[id] · admin/ops
src/app/api/webhooks/{fullenrich,stripe}/route.ts · api/jobs/{tick,daily}/route.ts · api/lists/[id]/export/route.ts
src/lib/fullenrich/{client,types,mapping,signature,cost}.ts
src/lib/credits/{estimate,plans,server}.ts · src/lib/stripe/{client,checkout,portal,webhooks}.ts
src/lib/csv/{parse,automap,normalize,export,xlsx}.ts · src/lib/email/resend.ts (send + per‑address rate limit via `email_sends`) · src/lib/email/templates/{layout,magic-link,…}.tsx
src/lib/supabase/{admin,queries}.ts · src/lib/jobs/{dispatch,reconcile,settle,rate-limit}.ts
src/components/base/{dialog,sheet,empty-state,skeleton,progress-bar,stepper,banner,toast}/
src/components/application/{header,list-card,contact-gauge,enrichment-progress,mapping-table,data-table,settings/*}
vercel.ts (crons) · .env.example · vitest.config.ts · playwright.config.ts
```

Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `FULLENRICH_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `MARGIN_MULTIPLIER`, `SENTRY_DSN`, `OPS_ALERT_EMAIL`, `ADMIN_EMAILS`.

## Sprint schedule (rebalanced after review)

**Day 1 — Docs, foundation, auth, Stripe catalogue**
- Write `docs/product_mvp.md`, `docs/screens.md`, `docs/fullenrich.md`, `docs/setup_manual.md`, `.env.example`, sample CSV.
- Install BoardUI set (table above) + build base components (dialog, toast provider, empty‑state, skeleton, progress‑bar, stepper, banner). Replace starter layout/page; root layout with `DirectionProvider`, theme, ToastProvider, fonts, metadata, Preb logo.
- Migration 0001 (tables, RLS, helpers, `handle_new_user`, credit functions, counters trigger, storage bucket, realtime). `generate_typescript_types`.
- Auth: login, callback, confirm, invite route, proxy redirects, onboarding screen. Magic‑link email via `generateLink` + react‑email + Resend (`email_sends` log, 5/h/address). **You do M1–M3** in parallel.
- FullEnrich client + key verify. Stripe products/prices created in **test mode** via MCP (30 min) so billing can be tested from day 3.

**Day 2 — Shell, dashboard, wizard**
- Header, account dropdown, credits dropdown, theme toggle, keyboard shortcuts.
- Lists dashboard (cards, gauge, toolbar, empty/skeleton states, responsive).
- Wizard steps 1–3 incl. upload to Storage, preview parsing, auto‑mapping, server `parseList`, validation summary, estimate card. `createList`/`startList` actions. First Vercel preview deploy (**M5 steps 1–4**).

**Day 3 — Enrichment engine**
- Credit functions wired; `tick` dispatcher with rate‑limit bucket; webhook handler (HMAC, idempotency); mapping + per‑contact cost; cache write‑through/read; pause/resume on credits; stop semantics; upstream 402 handling. Test with tunnel (**M6**) + zero‑credit contact + MSW tests.

**Day 4 — List detail & export**
- `EnrichmentProgress` fork, enriching view with polling table; completed view: generic `DataTable` (server pagination/sorting), filter rail/sheet, search, column settings, stat cards; export route (segments; original + appended columns); Download on cards.

**Day 5 — Billing**
- Checkout (subscription, address; no tax, §19 UStG), Portal config, Stripe webhook (grants, upgrades, cancel), plan picker dialog, Billing settings page, credits dropdown wiring, "Buy credits" CTAs, low‑credit email. Decide `MARGIN_MULTIPLIER`. **M4**.

**Day 6 — Team, emails, polish**
- Workspace settings (members, invites, roles), invite acceptance E2E; emails via react‑email on the day‑1 `EmailLayout` (invite, list finished, list paused, credits low, ops alert, welcome; magic link exists); dark‑mode pass; mobile pass; motion polish; error/loading routes; Sentry; `/admin/ops`.

**Day 7 — Reverse mode (if on track), QA, deploy**
- Morning: reverse email lookup mode (F5) — else defer. Afternoon: E2E runs (50‑row CSV with bad rows, duplicates, XLSX), ledger math vs `cost.credits`, webhook replay, cron reconcile with tunnel down, stop list, pause/resume on credits, RLS two‑workspace test, `get_advisors`, Lighthouse. Go‑live: live Stripe catalogue + webhook, prod env, `vercel --prod`, Supabase redirect URLs (**M2 step 4, M4 step 5, M5 step 6**).

## Session protocol (one chat per sprint day)

Why: a fresh chat per day keeps the agent working from the real docs instead of a compacted summary, costs less and is easier to steer. The repo docs are the memory; nothing is lost between sessions.

**Start of every session** (CTO pastes the kickoff prompt below):
1. Read `docs/progress.md` first (what is done, what is next, open issues, status of manual tasks M1–M8).
2. Read `docs/implementation_plan.md` section for the current day, plus `docs/product_mvp.md`, `docs/screens.md`, `docs/fullenrich.md` as needed (only the parts relevant to the day's work).
3. Check `AGENTS.md` (BoardUI rules) and `node_modules/next/dist/docs/` for any Next 16 API before writing code.
4. Confirm with the CTO which manual tasks are done before touching features that depend on them (auth → M1/M2, enrichment → M3/M6, billing → M4, deploy → M5).

**End of every session / day** (the agent does this unprompted when the day's checklist is complete, or when the CTO says "wrap up"):
1. Run `npm run build` and `npm run lint`; fix or note failures.
2. Update `docs/progress.md`: done ✅ / partially ⚠️ / not started ⬜ per plan item, deviations from the plan and why, open bugs, exact next steps, manual tasks still pending, any env vars added.
3. If the plan changed, update `docs/implementation_plan.md` in place (keep history short: a "Changes" line per day).
4. Tell the CTO: "Day N complete — please start a new chat for Day N+1 with the kickoff prompt."

**Mid‑day splits** — the agent must advise a new chat when: the conversation has been auto‑summarised/compacted once; it switches to an unrelated area (e.g. from the enrichment engine to Stripe); or after a long debugging detour. Before advising, it writes `docs/progress.md` so the next session can continue mid‑task.

**Kickoff prompt (paste unchanged at the start of each new chat)**
```
You are the senior implementation engineer on the Preb.co recruiting enrichment MVP.

1. Read docs/progress.md first. Continue with the item marked as next (the next sprint day, or the
   unfinished task if the last session stopped mid-day).
2. Read that day's section in docs/implementation_plan.md, including the "Session protocol" section,
   and only the parts of docs/product_mvp.md, docs/screens.md and docs/fullenrich.md you need.
3. Follow AGENTS.md strictly: BoardUI components first, semantic tokens, composite type utilities, cx(),
   Remix icons. Check node_modules/next/dist/docs before using any Next.js API. Pull Figma screenshots
   via the Figma MCP when building a screen.
4. Before testing anything that depends on a manual task (M1-M8 in docs/setup_manual.md), ask me whether
   it is done. Ask me only for decisions the plan leaves open.
5. Tell me in one line what you will do today, then work through the day's checklist.
6. When the day is done, or the conversation has been compacted, or you are switching to an unrelated
   area: run build + lint, update docs/progress.md, and tell me to start a new chat.
```

## Manual setup tasks (tools without MCP access) — step‑by‑step

Only these need your hands. Each is 5–15 minutes. Saved to `docs/setup_manual.md` on day 1 with checkboxes. Menu names as of Oct 2026; if a label differs, the setting lives in the same section.

**M1 · Google Cloud Console — reuse the old Preb OAuth client (day 1)**
1. https://console.cloud.google.com → select the project holding the old Preb OAuth client → *APIs & Services → Credentials*.
2. Open the existing *OAuth 2.0 Client ID* (type Web application).
3. *Authorized redirect URIs → Add URI*: `https://zigocelujwbasujrozpk.supabase.co/auth/v1/callback`. Keep old URIs.
4. *Authorized JavaScript origins*: add `https://preb.co` and `http://localhost:3000`. Save.
5. Copy *Client ID* and *Client secret* for M2 step 3.
6. *OAuth consent screen*: app name/logo "Preb", publishing status **In production** (otherwise only test users can sign in).

**M2 · Supabase dashboard — providers, URLs, secret key (day 1; step 4b on day 7)**
1. https://supabase.com/dashboard → project *preb-contact* (`zigocelujwbasujrozpk`).
2. *Authentication → Sign In / Providers → Email*: Email provider **on** (needed to verify magic‑link tokens; Supabase never sends the email itself). OTP expiry 3600 s. Save.
3. *Authentication → Sign In / Providers → Google*: **Enable**, paste Client ID + secret from M1. Save.
4. *Authentication → URL Configuration*: Site URL `http://localhost:3000` now (4b: change to `https://preb.co` at go-live). Redirect URLs: add `http://localhost:3000/**` and `https://preb.co/**`. Save.
5. *Project Settings → API Keys*: copy the **secret/service_role key** into `.env.local` as `SUPABASE_SECRET_KEY`. Never commit. Just tell me when done.
6. Leave *SMTP Settings* and *Email Templates* untouched — we don't use them. The Resend key (`RESEND_API_KEY`, sending‑only, preb.co) is already in `.env.local`.

**M3 · FullEnrich — account & API key (day 1)**
1. Sign up at https://app.fullenrich.com with a company email (50 trial credits). Before day 3 buy the smallest Pro plan (500 cr / $29) so real results and webhooks can be tested.
2. *Settings → API* (https://app.fullenrich.com/app/api) → *Create API key* "preb-prod" → `.env.local` `FULLENRICH_API_KEY`. Optionally set a per‑key consumption limit as a spend guard.
3. *Settings → Workspace*: enable **Personal email enrichment**. *Settings → Credits → Alerts*: alert at 20%.
4. Day 7: second key "preb-dev" for local testing.

**M4 · Stripe dashboard — items the API cannot toggle (day 5, step 5 on day 7)**
1. https://dashboard.stripe.com (account *Preb.co*). Turn **Test mode** on while building; I create catalogue, portal config and webhooks via MCP in test mode first.
2. *Settings → Tax*: enable **Stripe Tax**; add US registrations you have (else leave collection off; calculation still shows correct totals). Default tax code *SaaS – B2B* `txcd_10103001`.
3. *Settings → Billing → Customer portal*: check *Business information* (name Preb, support email, Terms/Privacy URLs from Leon's site) and *Branding* (new logo, accent).
4. *Settings → Business → Public details / Branding*: new Preb logo; statement descriptor `PREB.CO`.
5. Day 7: Test mode off; I create live catalogue + webhook; you run one real Checkout and refund it.

**M5 · Vercel — project, domain, env (day 2; step 6 on day 7)**
1. `npm i -g vercel` → `vercel login` (browser) → in the repo `vercel link` → create project `preb-app` in your team. Plan must be **Pro** (1‑minute cron, F4).
2. Vercel → project → *Settings → Domains → Add* `preb.co` (+ `www.preb.co` redirecting to it); apex uses an **A** record.
3. DNS for preb.co: move off Framer if needed, keep/re-create the Resend records, add the Vercel records. Wait for the green check.
4. *Settings → Environment Variables*: production only (no preview environment for now); values from `.env.local` with `NEXT_PUBLIC_APP_URL=https://preb.co` and live Stripe keys. Details in `docs/setup_manual.md` M5.
5. After the first deploy check *Settings → Cron Jobs* lists `/api/jobs/tick` (every minute) and `/api/jobs/daily` and both are enabled.
6. Day 7: `vercel --prod`.

**M6 · Local webhook tunnel (day 3)**
1. `brew install cloudflared`.
2. Second terminal: `cloudflared tunnel --url http://localhost:3000` → copy the `https://….trycloudflare.com` URL.
3. Set it as `NEXT_PUBLIC_APP_URL` in `.env.local`, restart `npm run dev`. The URL changes on each tunnel restart.

**M7 · Resend (one check; rest via MCP)**
1. https://resend.com/domains → `preb.co` shows **Verified** (DKIM, SPF) and a return‑path/MX record exists. Open/click tracking are already off. The sending‑only key `preb-supabase-smtp` (rename to `preb-app` if you like) is in `.env.local` as `RESEND_API_KEY`; the live Vercel env gets the same key on day 2 (M5 step 4).

**M8 · Legal (Leon, before launch)**
- Privacy policy: enrichment from third‑party providers, retention until list deletion, processors (FullEnrich, Supabase, Stripe, Resend, Vercel, Sentry), US sales, data‑deletion path (delete list / request workspace deletion). Terms: credit expiry (3 / 12 months, trial 30 days), credits consumed are non‑refundable, personal email data for recruiting use only. Links go to the login footer, signup consent checkbox, Configure‑step notice, and Stripe portal config.

## Changes
- Day 1: email strategy → Resend‑only, templates in app (`generateLink` + react‑email); M2 steps 5–6 (SMTP/templates) dropped; new table `email_sends` (migration 0003); Stripe test catalogue moved to a script (`npm run stripe:catalogue`) because the MCP has no sandbox access.
- Day 2 (auth): work‑email policy for sign‑up (app + DB, migration 0004); emails render HTML in `sendEmail` (`@react-email/render` direct dependency); email logo served from the public Storage bucket `brand` (`scripts/upload-brand-assets.ts`, optional `EMAIL_ASSET_BASE_URL` override).
- Day 2: `file-upload` forked to `components/application/upload-drop-zone` (real XHR progress to a signed Storage URL); mapping model = Preb field → column index (unmapped columns are passthrough automatically); email‑only rows stored as `skipped/email_only` until reverse mode (day 7); same‑workspace cache hits pre‑filled at parse time, cross‑workspace left to the engine; `row_limit` stored on `lists` for the dispatcher; Settings/Billing menu items point at `?settings=` until the modal fork (day 5/6).
- Day 5: migration 0007 (`subscription_status`, `cancel_at_period_end`, `low_credits_notified_at`); Stripe prices resolved by lookup key at runtime (`lib/stripe/catalogue.ts`), no `automatic_tax`, § 19 UStG footer on the customer; plan switches in-app (Stripe invoice preview → confirm → `subscriptions.update` with `always_invoice`, because the portal allows max 10 products and the catalogue has 14), portal limited to payment method, invoices and cancel at period end; settings modal forked to Profile · Members · Billing and driven by `?settings=`; `npm run stripe:portal` / `npm run stripe:webhook` scripts (CTO runs them — Stripe account changes are outside the agent's permissions); new env `STRIPE_WEBHOOK_SECRET` (required), `STRIPE_PORTAL_CONFIG_ID` (optional).
- Day 3: engine primitives in SQL (migration 0005 `claim_rate_slot`, `claim_pending_contacts`, `settle_batch`; 0006 allocates the provider-charged amount onto contacts so Σ contact cost = ledger); hold shrinks per settled batch, list may spend `available + own hold`; cross-workspace cache served via synthetic `provider='cache'` batches, same-workspace hits free at dispatch too; never-sent rows of a stopped list → `skipped/stopped`; `vercel.ts` crons; Vitest + MSW (`npm test`); new env `CRON_SECRET`, `OPS_ALERT_EMAIL`, optional `UPSTREAM_LOW_BALANCE`.

- Day 6: migration 0008 (`credits_available` returns 0 for non-member callers); Members page = `settings-members.tsx` + `lib/workspace/actions.ts` (invites re-issued with a fresh token on resend, 10/h/workspace); welcome email sent at the end of onboarding (owners only); auth redirects use `lib/auth/origin.ts: redirectOrigin()` (trusted hosts only — fixes `https://localhost` behind the tunnel); Sentry via `instrumentation*.ts` only, no `withSentryConfig` (v11 API differs; source maps deferred); `/admin/ops` under `(app)/admin/ops`; new env `NEXT_PUBLIC_SENTRY_DSN`.
- Go-live: production domain is the apex `preb.co` (Framer dropped; website to be built in-app post-MVP). Terms/Privacy links point to `/terms` and `/privacy` (public prefixes in the proxy; pages come with the website). Email/portal fallbacks and manual-task docs updated. Vercel: production environment only, CTO-operated (agent has read-only access at most).
- Day 7: reverse email lookup = opt-in per list for email-only rows (not a separate list type): migration 0009 (`list_contacts.kind`, `lists.reverse_lookup`, `lists.identified_rows`, `claim_pending_contacts(..., p_kind)`), dispatcher batches per kind, 1 credit × 0.7 find rate in the estimate; migration 0010 covering FK indexes (advisor); 0011 identified counter incl. cached rows. `startList` kicks `runTick()` in-process instead of POSTing its own URL. `parseList` sets `credits_cost: 0` explicitly (mixed cache-hit batches sent NULL). New `npm run qa:replay-webhook`. Go-live (M5) moved to a follow-up session.
- Post-launch: `/onboarding` moved under `(auth)` and doubles as the landing page for signed-in users without a workspace (app layout redirects there instead of `/login`); `lib/workspace/create.ts` creates an owned workspace without a trial; `lib/workspace/naming.ts` mirrors the trigger's naming.

## Verification

- `npm run build`, `npm run lint`, `npx next typegen`, Vitest green; Playwright smoke green.
- Auth: magic link arrives from `notifications@preb.co`; Google login; onboarding once; invite acceptance joins existing workspace without a second workspace/trial; unauthenticated redirect with `next`.
- Enrichment: 50‑row CSV (incl. zero‑credit contact, 3 invalid rows, 2 duplicates, 1 cached) → mapping auto‑detects → estimate shown → start → progress animates, table fills → completion email → export (All/Valid) opens with appended columns and passthrough columns; `lists.credits_used` = Σ batch `cost.credits`; `credits_available` = grants − consumed; `adjust` rows explain any per‑contact vs batch delta.
- Failure paths: webhook replay → no double counting; tunnel down → cron reconciles within 15 min; start with insufficient credits → blocked with CTA; credits run out mid‑list → `paused_credits`, resumes after test Checkout; upstream 402 simulated via MSW → `paused_upstream` + ops email; stop list → no new submissions, in‑flight settle; 429 → backoff.
- Billing: test Checkout → `invoice.paid` → grant with expiry; upgrade → difference granted; Portal opens; cancel → `plan_key` cleared; `expire_grants()` zeroes an artificially expired grant.
- Security: `get_advisors` clean; service key absent from client bundle (`grep` build output); webhook bad signature → 401; cron without secret → 401; RLS: user B cannot read workspace A lists/contacts/exports.
- UX: Lighthouse ≥90 perf/a11y on dashboard and list detail; 375 px and 1440 px; light/dark; keyboard through wizard, dialogs, table; reduced‑motion honoured.
