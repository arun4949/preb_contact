# Sprint progress log

Update at the end of every session. Newest day on top. Legend: ✅ done · ⚠️ partial · ⬜ not started.

## Day 3 — 2026-10-07 · Enrichment engine (complete, live E2E verified)

### Done
- ✅ **Migrations 0005 + 0006** (`supabase/migrations/0005_engine.sql`, applied via MCP, types regenerated): `claim_rate_slot(provider, kind)` (40 submits + 10 GETs per calendar minute, one atomic slot per call), `claim_pending_contacts(list, batch, limit)` (`FOR UPDATE SKIP LOCKED`, marks `submitted` + `batch_id`), `settle_batch(batch)` (settles exactly once: charges the provider's `cost.credits` — fallback derived sum — via `consume_credits`, logs `adjust` −shortfall "Overdraft absorbed" and a 0-delta `adjust` when provider ≠ derived, **shrinks the list's open hold by the charged amount** so `credits_available` never double-counts), plus engine indexes.
- ✅ **Engine** `src/lib/jobs/`: `shared.ts` (admin types, structured `log`, hold/credit helpers, `spendableCredits` = available + own hold), `rate-limit.ts`, `payload.ts` (pure builders, `ENRICH_FIELD_MAP`), `results.ts` (`contactPatchFromRecord`, `applyRecords` idempotent upsert + cache write-through, `applyTerminalResult`: leftover `submitted` → `failed/no_result`, or back to `pending` on CREDITS_INSUFFICIENT), `settle.ts` (`settleBatch`, `settlePending` safety net, `finalizeList`: enriching→completed / stopping→stopped, `row_limit` → remaining pending `skipped/row_limit`, hold release, finished email), `dispatch.ts` (runnable = queued|enriching|paused_credits, paused_upstream retried every 15 min; ≤4 batches/list/tick, ≤100 rows, respects `row_limit`; **cross-workspace cache hits (F2)** served through a synthetic `provider='cache'` batch and charged via `settle_batch`; credits ≤0 → `paused_credits` + email once; 429 → stop run; 402 → `paused_upstream` + ops email; 3 rejected batches/h → list `failed` + ops email), `reconcile.ts` (stale unsubmitted batches released after 5 min; poll after 15 min without webhook, ≤1 GET/10 min/batch, ≤10/tick; handles in_progress/402 partial/404 lost), `tick.ts` (`runTick`: settle → reconcile → dispatch → finalize, each step isolated), `daily.ts` (`expire_grants`, orphan holds, upstream balance alert < max(`UPSTREAM_LOW_BALANCE`=200, 2× largest open hold), drafts > 24 h deleted incl. Storage, processed `webhook_events` > 30 d deleted), `notify.ts` (never throws).
- ✅ **Routes**: `/api/jobs/tick` (GET cron / POST from `after()`, `CRON_SECRET`, `maxDuration 60`, 207 when a step errored), `/api/jobs/daily`, `/api/webhooks/fullenrich` (raw body → HMAC-SHA1 `timingSafeEqual` → 401; contact events `status IN_PROGRESS` vs terminal batch events; idempotent by `webhook_events (provider, external_id)` = `<id>:<contact_id>:contact` / `<id>:batch:<STATUS>`; unknown batch → 200 ignored; processing error → 500 so the provider retries).
- ✅ **Emails** on `EmailLayout`: `list-finished.tsx`, `list-paused.tsx` (Buy credits → `/lists?settings=billing`), `ops-alert.tsx`. Ops address = `OPS_ALERT_EMAIL` → first of `ADMIN_EMAILS`.
- ✅ `vercel.ts` (`@vercel/config`): crons `* * * * *` tick, `0 3 * * *` daily (Pro plan, F4). `.env.local` gained `CRON_SECRET` (generated) and `OPS_ALERT_EMAIL`.
- ✅ **Tests**: `vitest` + `msw` installed (`npm test`, `vitest.config.mts`, `server-only` aliased to `src/test/server-only.ts`). 24 tests: signature, mapping/credits, payload builders, result patches, MSW provider client (200 / 429 / 400 in_progress / 402 partial / 404). Fixtures in `src/lib/fullenrich/__fixtures__/records.ts`.
- ✅ **SQL smoke test** (DO block, rolled back): rate caps enforced, claim marks 2 rows + counters, `settle_batch` charged 3 vs derived 2 → adjust row, hold 5 → 2, `credits_available` unchanged, idempotent on re-run.
- ✅ `npm run build` ✓ · `npm run lint` ✓ (upstream data-table warning only) · `npx tsc --noEmit` ✓ · `npm test` ✓. `@types/node` bumped to ^22 (vitest 5 peer).

### Credit model as implemented (differs slightly from the plan text)
- Hold = typical estimate at start; **each settled batch reduces the hold by the charged amount**; the rest is released when the list ends. The dispatcher lets a list spend `credits_available + its own open hold`. Ledger `consume` rows total the provider-charged amount; `credits_used` on the list is the per-contact derived sum (display), the ledger is the truth.
- Same-workspace cache hits stay free (parse time). Cross-workspace hits are charged at the derived per-contact cost (no provider cost to reconcile against).

### Live E2E (tunnel + real provider, then signed local webhooks)
- ✅ **Zero-credit contact, real provider**: tick → batch accepted → per-contact webhook + batch FINISHED webhook through the tunnel → settled → list `completed` in 13 s, hold released, "list is enriched" email sent. Contact enriched with DELIVERABLE work + personal email and MOBILE phone.
- ✅ **Pause/resume**: workspace at 0 spendable → list `paused_credits` + paused email; after credits freed, the next tick resumed it (served free from own-workspace cache) → `completed`.
- ✅ **Stop**: list `stopping` with one in-flight batch + one pending row → batch webhook settled it → `stopped`, hold released, pending row never sent (now `skipped/stopped`), stopped email.
- ✅ **Webhook security**: wrong signature → 401; valid → 200; replay → 200 `duplicate:true`, no double processing.
- ✅ **Reconciler, real provider GET**: batch silent for 20 min → polled → 404 → row `failed/provider_lost`, list completes; crashed batch without provider id → rows released after 5 min and re-dispatched.
- Test lists deleted afterwards. The provider cache entry for the test contact stays (useful for future free tests).

**Bugs found and fixed during E2E**
- Provider charged 0 (upstream 3-month dedup) but `credits_used` showed 14 (derived) → **migration 0006**: `settle_batch` re-allocates the authoritative charge onto the batch's contacts in row order, so Σ contact cost = ledger consumption. Existing batch corrected.
- Same-workspace cache hits found at dispatch time were charged → now `cached` and free, like parse-time hits (cross-workspace hits still charged, F2).
- Stopped lists kept never-sent rows as `pending` → `finalizeList` and `stopList` mark them `skipped/stopped`.
- Reconcile summary didn't count lost (404) batches as resolved.

### Open items
- Advisors (security): new engine functions are clean. Pre-existing from day 1: `credits_available` is callable by any signed-in user for any workspace id (leaks a balance number only) → add a membership check on day 7. Info-only "RLS enabled, no policy" on the four service-only tables (intended).
- Not exercised live: upstream 402 / `paused_upstream` and 429 (covered by MSW tests and code paths only); real per-contact charging against a paid contact (SQL smoke test covers the ledger math).
- The quick-tunnel URL changes on every `cloudflared` restart → update `NEXT_PUBLIC_APP_URL` each time.

### Manual tasks status
| Task | Status |
|---|---|
| M1 Google OAuth redirect URI | ✅ |
| M2 Supabase providers / URLs / secret key | ✅ |
| M3 FullEnrich account + API key | ✅ key; 500-credit plan purchase unconfirmed (50 trial credits suffice for the zero-credit E2E) |
| Stripe sandbox key + test catalogue | ✅ |
| M4 Stripe dashboard (Tax, portal branding) | ⬜ (day 5) |
| M5 Vercel project + domain + env | ⚠️ `vercel.ts` ready; CLI install, domain, env vars (incl. `CRON_SECRET`), first deploy pending |
| M6 Local tunnel | ✅ quick tunnel running; URL updated by the CTO |
| M7 Resend domain check | ✅ |
| M8 Legal pages (Leon) | ⬜ |

### Next: Day 4 — List detail & export
1. `EnrichmentProgress` fork for the enriching view (realtime on `lists` + polling table), completed view with forked generic `DataTable` (server pagination/sorting), filter rail/sheet, search, column settings, stat cards.
2. Export route `/api/lists/[id]/export` (segments; original + appended columns; skip reasons incl. `stopped`, `row_limit`, `provider_lost`); flip `EXPORT_READY` in `list-card.tsx`.
3. Show "Already enriched" for `cached` rows and `credits_used` from the list (now equals the ledger).


## Day 2 — 2026-10-07 · Shell, dashboard, wizard (complete, browser-verified)

### Done
- ✅ **Stripe test catalogue** created: 14 products/prices at margin ×1.15 (`preb_<plan_key>` lookup keys, e.g. Pro 500 → $33/mo, Pro 6k → $359/yr). `npm run stripe:catalogue` now loads `.env.local` via `tsx --env-file`.
- ✅ **Header** `components/application/header/`: `app-header.tsx` (logo, underline `Tabs` with Lists, pill **New list** + tooltip `N`, mobile icon button), `credits-dropdown.tsx` (Figma 1015:35: balance / plan, `ProgressBar`, next expiry, trial chip, red dot <10 %), `account-dropdown.tsx` (1015:33: avatar, name/workspace/email, Settings · Billing → `/lists?settings=…` until the settings modal lands day 5/6, Help/Feedback mailto, **theme toggle** segmented row, Log out), `use-shortcuts.ts` (`N` → /lists/new, `/` → focus search; ignored while typing or with a dialog open).
- ✅ **Queries** (`lib/supabase/queries.ts`): `getLists(ws, user, {status, owner, q})` (status groups enriching/completed/paused, ilike search, drafts hidden), `getWorkspaceMembers`, `getCreditSummary` (available, plan credits, earliest expiry, isTrial). `(app)/layout.tsx` passes the summary to the header.
- ✅ **Lists dashboard** `(app)/lists/page.tsx` (1015:30): gradient workspace avatar, title + count `Badge`, `ListsToolbar` (status `Select` with `StatusDot`, owner `Select`, debounced search → URL params, `Kbd /`), grid 1→2→3, filtered + first-run `EmptyState`, `loading.tsx` with `SkeletonCard`s.
- ✅ **ListCard** `components/application/list-card/list-card.tsx`: status strip (Enriched ✓ date · Enriching with `ComposerLoader` rim + `AgentThinking` shimmer + % · Paused ⚠ · Stopped), title link, **`ContactGauge`** (`contact-gauge/contact-gauge.tsx`, 180° SVG, `chart-1` valid / `chart-3` risky arcs via `motion`, count-up, sweep while enriching, reduced-motion safe), metric rows with `Chip` percentages, Download All (disabled until done — export is day 4), overflow `Dropdown` → Rename `Dialog`, Stop/Delete `ConfirmDialog`. `list-status.tsx` = status → label/chip map.
- ✅ **CSV lib** `lib/csv/`: `parse.ts` (PapaParse auto-delimiter, BOM strip, UTF-8→Latin-1 fallback, SheetJS first sheet, 10k-row / 20 MB caps, `truncated` flag), `automap.ts` (`PrebField`, `ColumnMapping` = field → column index, synonym table EN/DE/FR/ES), `normalize.ts` (domain/LinkedIn/email cleaning, full-name split, enrichability, dedup key, `normaliseRows` summary).
- ✅ **List actions** `lib/lists/actions.ts` (server): `createDraftList` (draft row + signed upload URL), `attachUpload`, `parseList` (download from Storage, parse, normalise, dedup, **cache lookup** same-workspace <90 d → `cached` rows pre-filled via `mapRecord`, delete+insert `list_contacts` in 1,000-row batches, stores mapping/has_header/duplicates), `startList` (validates fields/name, requires `available ≥ typical`, inserts `credit_holds`, sets `queued` + estimates + `row_limit`, `after()` → POST `/api/jobs/tick`, redirects to `/lists/[id]`), `renameList`, `stopList` (queued → stopped + release hold; running → `stopping`), `deleteList` (hard delete + Storage cleanup + hold release), `discardDraft`.
- ✅ **Wizard** `(app)/lists/new` + `components/application/new-list/`: `new-list-wizard.tsx` (Stepper, sparkle header, Go back, step slide animations `animate-step-forward/back`, draft discarded on back/unmount), `step-upload.tsx` (1015:39: Contacts/Companies `SegmentedControl` with "Soon", 2×2 source cards, **`UploadDropZone`** = fork of `file-upload` driven by a real XHR PUT to the signed URL with progress (`upload-client.ts`), client-side parse via dynamic import, auto-advance), `step-map.tsx` (1015:41: info `Banner`, one row per Preb field with column `Select` + clear + example value, live summary card enrichable / missing (view first 5) / duplicates / email-only, "First row contains headers" `Switch` re-parses, Next → `parseList`), `step-configure.tsx` (1015:43: three `CheckboxCard`s with credit chips, list name, rows presets + input, **estimate card** "Typically ~M · up to N · you have A" with `ProgressBar`, shortfall `Banner` + Buy credits placeholder, Start enrichment).
- ✅ `/lists/[id]` placeholder (breadcrumb, status chip, counters) so `startList` has a landing page until day 4. `/api/jobs/tick` stub (checks `CRON_SECRET`, returns `ran:false`) until day 3.
- ✅ `npm run build` ✓ · `npm run lint` ✓ (only the upstream data-table warning) · `npx tsc --noEmit` ✓. Installed `papaparse`, `xlsx`, `@types/papaparse`.

### Browser verification (Chrome, signed in with Google)
- ✅ Google sign-in → `/onboarding` (prefilled name + workspace) → `/lists`; trial shows **25 credits** (day-1 auth smoke test passes for Google; magic link still untested).
- ✅ Header: credits dropdown (25/25, trial chip, expiry Nov 6), account menu, theme toggle, `N` and `/` shortcuts, Lists tab.
- ✅ Wizard with a semicolon CSV (BOM, German headers, duplicate by LinkedIn, row missing company): auto-map correct, summary 2/4 enrichable · 1 missing · 1 duplicate, `parseList` stored cleaned domain + canonical LinkedIn, counters trigger filled the list.
- ✅ Configure: estimate, shortfall banner with 60 rows + mobile (needs 323 more, Start disabled), clears when rows reduced.
- ✅ Start → `/lists/[id]` Queued, credits 25 → 23 (hold). Card: loader rim, gauge sweep, Rename (toast), search/filter via URL + no-match state + Clear filters, Stop (queued → stopped, hold released, back to 25), Delete (rows + Storage file removed).
- ✅ Draft cleanup on Go back and on navigating away mid-wizard (row, contacts and file removed).
- ✅ Dark mode (no flash on load), light mode, 390 px width without horizontal scroll.

**Bugs found and fixed during the walkthrough**
- Server page imported `initialsOf` from a client module → moved to `src/utils/initials.ts`.
- Google avatar didn't load → `Avatar` now uses `referrerPolicy="no-referrer"` and falls back to initials on error (Avatar is now a client component).
- `N` ignored while a React Aria button had focus (it stops keydown propagation) → shortcut listener uses the capture phase.
- Auto-map put "Full Name" into Last name (substring "lname") → exact matches for all fields first, substring fallback only with synonyms ≥ 6 chars. Checked against 5 header sets.
- Mobile header showed wordmark + icon (theme-logo CSS overrode `hidden`) → wordmark wrapped in a responsive span.
- Root-layout inline `<script>` warning → `next/script` `beforeInteractive`.
- Polish: shimmer timer removed from card strip, softer loader rim, consistent select widths in mapping, singular/plural copy, stop toast wording, Download disabled until export exists (`EXPORT_READY` flag in `list-card.tsx`, flip on day 4), name-field hints.

### Magic link (fixed after CTO test)
- Sign-in by email failed with "We couldn't send the link right now": the Resend SDK could not resolve `@react-email/render` (only nested under `@react-email/components`). Fix: `@react-email/render` installed directly and `sendEmail` now renders `html` + `text` itself; `sendMagicLink` logs the underlying error. A rendered test email was accepted by Resend (id `01a11636…`). **CTO to re-test the magic link once** (click the link → `/auth/confirm` → `/lists`).

- Logo missing in the email: it pointed at `localhost`. Fixed: `public/logoName.png` + `logo.png` uploaded to the new public Storage bucket `brand` (migration 0004, `scripts/upload-brand-assets.ts`); `EmailLayout` uses `brandAssetUrl()` (optional `EMAIL_ASSET_BASE_URL` override). Verified: the public URL serves `image/png`.

### Work-email policy (new CTO requirement, day 2)
- `src/lib/auth/work-email.ts`: ~100 free‑mail/disposable domains (+ sub‑domain match). `sendMagicLink` rejects before creating the user; the Google callback deletes a just‑created free‑mail user (no invite) and redirects to `/login?error=work_email`. Exceptions: `ADMIN_EMAILS` (the CTO's gmail stays valid) and addresses with a workspace invite. Existing accounts keep working.
- DB defense in depth (migration 0004): `public.is_free_email_domain()`; `handle_new_user` never grants a trial to a free‑mail domain (even via an invite‑less bypass). Plan § Decisions 2a, `.env.example`, `setup_manual` M7b updated.

### M6 tunnel + leftovers
- ✅ **M6 done by the agent**: `cloudflared` quick tunnel → `NEXT_PUBLIC_APP_URL` in `.env.local` (URL changes on every tunnel restart — update `.env.local` and the dev server reloads). `next.config.ts` allows `*.trycloudflare.com` via `allowedDevOrigins` (dev only). Verified through the tunnel: `/login` 200, `/api/jobs/tick` 401 without secret.
- `appOrigin()` (auth redirects) now prefers the request origin when it is localhost or the configured app URL, else falls back to `NEXT_PUBLIC_APP_URL` — sign-in from localhost stays on localhost while webhooks use the tunnel; forged Host headers can't redirect sign-in links.
- ⚠️ **Leftover test account** `arun.gupta494@gmx.de` (created at 11:52 by the first, failing magic-link attempt, before the work-email rule; own "Gmx" workspace with 25 trial credits, never signed in). The agent's delete was blocked by the permission classifier → **CTO deletes it** in Supabase → Authentication → Users (delete user) and Table editor → `workspaces` row "Gmx".
- Magic link verified with logo (gmx.de mail received). Blocking of new free-mail sign-ups verified in the browser.

### Still not verified
- Magic-link end-to-end click-through with the logo visible (send fixed, logo fixed; confirm step not yet exercised).
- XLSX upload (parser path is shared with CSV; test on day 7 QA).

### Deviations / notes
- Settings/Billing menu items navigate to `/lists?settings=profile|billing` (ignored for now); wire to the forked `settings-modal` on day 5/6. "Buy credits" shows an info toast until Checkout exists.
- Email-only rows are counted as "email-only (reverse lookup coming soon)" and stored `skipped/email_only` — day 7 flips them to reverse mode.
- Cross-workspace cache hits are not pre-filled (day 3 engine serves them from cache and charges normally, F2). Same-workspace hits are free and pre-filled.
- XLSX preview parses on the main thread via dynamic import (no web worker) — fine up to 10k rows; revisit if it stutters.
- `row_limit` is stored on the list; the day-3 dispatcher must respect it (submit at most `row_limit` pending rows).
- `generateLink`-style sign-in bypass was **not** used for testing; sign-in stays manual.
- M5 steps 2–4 (domain, env vars) and the first preview deploy are still pending — Vercel CLI isn't installed locally (`npm i -g vercel`, then `vercel link`).

### Manual tasks status
| Task | Status |
|---|---|
| M1 Google OAuth redirect URI | ✅ |
| M2 Supabase providers / URLs / secret key | ✅ |
| M3 FullEnrich account + API key | ✅ (buy 500‑credit plan before day 3) |
| Stripe sandbox key + test catalogue | ✅ |
| M4 Stripe dashboard (Tax, portal branding) | ⬜ (day 5) |
| M5 Vercel project + domain + env | ⚠️ project created; CLI install, domain, env vars, first deploy pending |
| M6 Local tunnel | ✅ (quick tunnel; URL changes per restart) |
| M7 Resend domain check | ✅ |
| M8 Legal pages (Leon) | ⬜ |

### Next: Day 3 — Enrichment engine
0. Re-test magic-link sign-in end-to-end (send is fixed), then start the engine.
1. `lib/jobs/{rate-limit,dispatch,reconcile,settle}.ts` + real `/api/jobs/tick` (FOR UPDATE SKIP LOCKED, ≤40 submits + ≤10 GETs/min, batches ≤100, respects `row_limit`, pause on credits ≤0, 402 → `paused_upstream`), `/api/jobs/daily`, `vercel.ts` crons.
2. `/api/webhooks/fullenrich` (HMAC‑SHA1 on raw body, `webhook_events` idempotency, contact upsert via `mapRecord`, batch terminal → settle: `consume_credits`, adjust, cache write‑through, hold release, list finalise).
3. Stop semantics (`stopping` → `stopped` when in-flight batches settle), M6 tunnel + zero‑credit contact E2E, MSW tests.

## Day 1 — 2026-10-07 · Foundation, auth, migration (code complete; E2E untested)

### Done
- ✅ **BoardUI installs** (62 files): tabs, buttons, dropdown, input, select, checkbox(-card), radio(-card), switch(-card), textarea, segmented-control, chip, badge, status-dot, kbd, avatar, breadcrumb, pagination, tooltip, divider, file-upload, table, data-table, stat-cards, notification, settings-modal, auth-card, social-button, agent-progress, agent-thinking, composer-loader, theme-toggle, direction, logo, use-count-up. (`notification-center` = stretch, not installed.)
- ✅ **Base components** in `src/components/base/`: `dialog` (`Dialog`, `ConfirmDialog`, react-aria modal, settings-modal motion recipe), `sheet`, `empty-state`, `skeleton` (+ `SkeletonText/Card/Rows`), `progress-bar`, `stepper`, `banner`, `toast` (`ToastProvider`, `useToast` on BoardUI Notification). Keyframes appended to `src/styles/globals.css` (dialog/sheet motion, skeleton shimmer, `animate-page-enter`, reduced-motion).
- ✅ **Root layout**: Inter via `--font-inter`, `DirectionProvider locale="en-US"`, `ToastProvider`, metadata, pre-paint theme script (reads `boardui:theme`). `Logo`/`LogoName` now render Preb SVGs (`public/logoName-dark.svg` added for dark mode). Starter page/assets removed.
- ✅ **Migration 0001** applied via MCP (`supabase/migrations/0001_schema.sql` is the copy): enums, all tables from the plan (+ `lists.file_name/has_header/row_limit/credits_max/error`, `list_contacts.company_logo_url`, `enrichment_batches.settled_at`, `provider_rate_limit` keyed by provider with submit/get counters), RLS + `is_workspace_member/admin`, `credits_available`, `consume_credits` (earliest-expiry, returns actual consumed), `expire_grants`, `grant_credits` (idempotent on invoice), `handle_new_user` (invite → membership, else workspace + owner + 25-credit trial with provider_id / domain guard), statement-level counters trigger, `list-uploads` bucket + storage policies, realtime on `lists`. **0002** revokes API execute on trigger functions. Smoke-tested in a rolled-back txn: signup trigger, trial grant, overdraft consume. Advisors: only INFO "RLS enabled, no policy" on the three service-only tables (intended).
- ✅ Types → `src/lib/supabase/types.ts`; typed `createClient` (browser/server/proxy); `src/lib/supabase/admin.ts` (`server-only`); `queries.ts` (`getUser`, `getProfile`, `getSessionContext`).
- ✅ **Auth**: `proxy.ts` redirects anonymous app routes to `/login?next=`, passes `/auth/*`, `/invite/*`, `/api/webhooks/*`, `/api/jobs/*`; `/login` (Google + magic link, "check your inbox" state, error banners), `/auth/callback` (PKCE), `/auth/confirm` (token hash), `/auth/signout`, `/invite/[token]` (+ accept action, email must match), `/onboarding` (name + workspace name; invitees skip), `/lists` placeholder with empty state, day-1 `AppHeader` (replaced day 2). `src/lib/auth/{actions,invite}.ts`.
- ✅ **FullEnrich**: `src/lib/fullenrich/{types,client,signature,mapping}.ts` (verify key, credits, bulk start/get, reverse, `ProviderError` flags, HMAC-SHA1 verify, record → columns + per-contact cost). `src/lib/credits/{plans,estimate}.ts`.
- ✅ **Email = Resend only, templates in app** (CTO decision, replaces Supabase SMTP): `src/lib/email/resend.ts` (`sendEmail`, `isRateLimited` 5 magic links / h / address via new `email_sends` table, migration 0003), `templates/layout.tsx` + `magic-link.tsx` (react‑email). `sendMagicLink` now uses `auth.admin.generateLink({type:"magiclink"})` and sends through Resend. Resend sending‑only key (preb.co) created via MCP → `.env.local` `RESEND_API_KEY`. `public/logoName.png` added for email clients.
- ✅ `npm run build` ✓ · `npm run lint` ✓ (1 upstream warning in data-table; rule override scoped to BoardUI settings-modal/plan-art/date-picker, removed on day 6 fork) · `npx tsc --noEmit` ✓ · login page renders in Chrome without console errors.

### Deviations / notes
- ⚠️ **Stripe test catalogue not created**: the Stripe MCP only exposes the live account and the Stripe CLI keys expired (Sept 2026). Script ready: `scripts/stripe-catalogue.ts` (`npm run stripe:catalogue`, idempotent, lookup keys `preb_<plan_key>`). CTO adds a sandbox `sk_test_…` as `STRIPE_SECRET_KEY` in `.env.local`, then run it (day 2 start).
- Onboarding has no "hiring for" select (no column in the schema; optional in the plan). Add later if wanted.
- `@tanstack/react-table`, `server-only`, `stripe`, `resend`, `@react-email/components`, `tsx` installed. Not yet: `papaparse`, `xlsx`, `@sentry/nextjs`, `vitest`.
- Trial guard uses `raw_user_meta_data.provider_id` (Google) and `profiles.email` domain; magic-link users have no provider id so only the domain guard applies.

### Not tested (M1–M3 pending)
Google sign-in, magic-link delivery via Resend, onboarding flow, invite acceptance, FullEnrich key verify. Verify at the start of day 2 once M1–M3 are done: sign in → `/onboarding` → `/lists` shows 25 credits in the header.

### Manual tasks status
| Task | Status |
|---|---|
| M1 Google OAuth redirect URI | ✅ |
| M2 Supabase providers / URLs / secret key (no SMTP, no templates) | ✅ |
| M3 FullEnrich account + API key | ✅ (key verified, 50 trial credits; buy 500‑credit plan before day 3) |
| Stripe sandbox secret key in `.env.local` (new, for the catalogue script) | ✅ (test key verified) |
| M4 Stripe dashboard (Tax, portal branding) | ⬜ (day 5) |
| M5 Vercel project + domain + env | ⚠️ project created; domain + env vars pending |
| M6 Local tunnel | ⬜ (day 3) |
| M7 Resend domain check | ✅ |
| M8 Legal pages (Leon) | ⬜ |

### Next: Day 2
1. M1–M3 and the Stripe test key are done: run the auth smoke test above (Google + magic link from notifications@preb.co → onboarding → 25 credits), then `npm run stripe:catalogue`.
2. Header (tabs, New list, credits dropdown, account dropdown, theme toggle, shortcuts) replacing `components/application/header/app-header.tsx`.
3. Lists dashboard (ListCard, ContactGauge, toolbar, skeleton/empty states) at Figma `1015:30`.
4. Wizard steps 1–3 (`1015:39/41/43`), upload to Storage, preview parsing (install `papaparse`, `xlsx`), auto-mapping, `parseList`, estimate card, `createList`/`startList`. M5 steps 1–4 for the first preview deploy.

## Day 0 — 2026-10-07 · Planning (complete)
- ✅ Research: FullEnrich API v2, pricing, Wiza UX, BoardUI component APIs, Next 16 differences, repo state.
- ✅ Plan approved by CTO after two review loops → `docs/implementation_plan.md`.
- ✅ Docs written: `product_mvp.md`, `screens.md`, `fullenrich.md`, `setup_manual.md`, `.env.example`, `public/samples/contacts-template.csv`.
- Decisions: subscription tiers (USD) · 25 trial credits · fields = work email / personal email / phone, reverse email lookup as day‑7 stretch · Vercel on app.preb.co. Open flags F1–F7 with defaults in the plan.
- Repo state: scaffold only (Next 16.3, BoardUI initialised with `Button` only, Supabase clients, no tables/migrations, no auth).

### Manual tasks status
| Task | Status |
|---|---|
| M1 Google OAuth redirect URI | ⬜ |
| M2 Supabase providers / SMTP / URLs / secret key | ⬜ |
| M3 FullEnrich account + API key | ⬜ |
| M4 Stripe dashboard (Tax, portal branding) | ⬜ (day 5) |
| M5 Vercel project + domain + env | ⬜ (day 2) |
| M6 Local tunnel | ⬜ (day 3) |
| M7 Resend domain check | ⬜ |
| M8 Legal pages (Leon) | ⬜ |

### Next (superseded by Day 1 above)
Docs are done → start with BoardUI installs + base components, root layout, migration 0001, auth routes, onboarding, FullEnrich client, Stripe test catalogue. Needs M1–M3 for end‑to‑end auth/enrichment testing; code can be written before they are done.
