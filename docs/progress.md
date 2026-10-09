# Sprint progress log

Update at the end of every session. Newest day on top. Legend: ✅ done · ⚠️ partial · ⬜ not started.

## Notification center + admin announcements — 2026-10-09 · header bell, workspace events, admin dashboard (complete, walked in a browser)

### Decisions (CTO)
- Admin allow-list stays the env var `ADMIN_EMAILS` (no hardcoded addresses). **Set `ADMIN_EMAILS=arun@preb.co,leon@preb.co` in Vercel** (M10); locally it stays the Gmail test account.
- Enrichment notifications go to the list creator only; team events to every member; billing/credit events to owners and admins; low credits to everyone (owners/admins get the billing link, members plain news).
- Announcements are in-app only (no email). Tabs: **All · Activity · Announcements**.

### Done
- ✅ **Migrations 0014–0016** (applied via MCP, types regenerated): `notifications` (one row per recipient, `kind` text + check, `dedupe_key` unique per user, `read_at`; RLS select/update own rows, column-level grant so the app can only write `read_at`, inserts service-role only; added to the realtime publication), `admin_notifications` (service-role only), trigger `notify_member_joined` on `workspace_members` (covers both join paths: signup through an invite inside `handle_new_user`, and `acceptInvite`; owners excluded), `send_admin_notification()` fans an announcement out to all users / selected users / whole workspaces in one statement. Advisors: no new findings.
- ✅ **Server** `src/lib/notifications/`: `copy.ts` (every text, tested, no dashes), `emit.ts` (`notifyUsers` / `notifyWorkspace`, never throw, role-aware copy, dedupe via upsert), `queries.ts`, `actions.ts` (feed, mark read, mark all read; **no `revalidatePath`**, the bell owns its state), `admin-actions.ts` (recipients, send through the RPC, history with read counts), `announcement.ts` (shared validation).
- ✅ **Events wired** (one line next to the existing email or state change): list ready/stopped (`notify.ts`, manual runs say "Enrichment of … is ready" and link to `/enrich`), paused for credits, paused upstream and failed (`dispatch.ts`, in-app only, ops keeps its email), low credits (`low-credits.ts`), credits added on `invoice.paid`, plan started / changed / cancel scheduled / cancel reverted / canceled (`subscriptionChange()` in `lib/stripe/webhooks.ts` diffs the stored row against the patch; unit-tested), credits and trial expiring 7 days ahead + 90-day retention (`daily.ts`), member removed / left / role changed (`workspace/actions.ts`), joined / welcome (trigger).
- ✅ **UI**: BoardUI `notification-center` installed via MCP and forked (tabs with unread counts, rows grouped Today / Yesterday / This week / Earlier, clickable rows, Preb mark for announcements, kind icons, per-tab empty states, internal scroll region with the AGENTS.md top fade via new `components/base/scroll-fade`). Header bell between New list and Credits (`header/notifications-dropdown.tsx`): unread badge, popover, realtime INSERT → server-action refetch → toast (coalesced per burst, hidden tab = no toast), optimistic read state, refetch on tab focus. Account menu gets an **Admin** group (Announcements · Ops) for `ADMIN_EMAILS`.
- ✅ **`/admin/notifications`**: composer (title 80, message 500, optional link, audience All users / Selected users with search / Workspaces, live preview of the exact row, "Send to N users" with confirm), history table (audience, recipients, read %). Non-admins get the branded 404.
- 🐞 **Realtime fix (pre-existing)**: the browser client never put the user's JWT on the realtime socket, so `postgres_changes` on RLS tables silently delivered nothing (the 5 s poll hid it on list detail / Enrich). New `utils/supabase/realtime.ts: createRealtimeClient()` sets the auth before subscribing; used by the bell, list detail and the Enrich table. Verified: inserts now arrive live.
- ✅ **Bell restyled (CTO feedback: the round blue ghost trigger looked cheap)**: now the BoardUI Finance template bell (`template-notification-center-menu`): secondary square `icon-button` recipe (bordered, `shadow-xs`, `RiNotificationLine`) with the template's red count dot; `icon-button.tsx` exports `iconButtonStyles` so the React Aria `DropdownTrigger` can wear it. The template's raw `bg-red-600` is the token `bg-foreground-icon-error` (same red in light, red-400 in dark). Checked at 1440/375 px, light/dark, hover and open.
- ✅ **Header tab on admin pages (CTO feedback)**: `/admin/notifications` and `/admin/ops` no longer highlight Lists. React Aria force-selects the first tab when nothing is selected, so pages outside the tabs render the same two items as plain links (identical styling, no underline, still keyboard-reachable); `TabList` hides its underline when no tab is selected. No admin tab added (CTO). Also fixed a hydration warning: the announcement preview stamped `new Date()` on server and client; it now uses a fixed "now" label. Verified: admin pages none selected, Tab key reaches Lists then Enrich, Enter navigates, Lists/Enrich pages unchanged, 0 hydration warnings, 1440 light and 375 dark.
- ✅ Phone header: the coin trigger shows the icon only below `sm` (balance one tap away) so Lists · Enrich · + · bell · coin · avatar fit at 375 px.
- ✅ `npm run lint` ✓ (2 upstream warnings) · `npx tsc --noEmit` ✓ · `npm test` ✓ (**82**, new: copy, timeAgo/groupOf, subscriptionChange) · `npm run build` ✓.

### Browser walk (Playwright headless, localhost, no browser MCP available)
- ✅ Empty bell, light/dark, 1440 and 375 px; Escape closes; `N` shortcut suppressed while open.
- ✅ Test invitee created through the real path (pending invite + `auth.admin.createUser`) → trigger produced "Nora joined …" for the two members and a welcome for her; Arun's row click opened the Members modal and cleared the badge.
- ✅ Announcement to 2 selected users: confirm dialog → toast → history row; the other open tab's badge went 1 → 2 **live** and showed the toast, "View" opened `/enrich` and marked it read. Non-admin: 3 unread (welcome + 2 announcements), no Admin group, `/admin/notifications` → 404 page.
- ✅ Members modal: role Member → Admin → "You are now an admin of …" in the member's bell.
- ✅ Manual enrichment of a cached contact (free) → "Enrichment of Satya Nadella is ready" arrived live, link to `/enrich`.
- ✅ Integration smoke on a throwaway workspace (signed fake Stripe events against the local endpoint, real `maybeNotifyLowCredits` / `runDaily`): plan_started, quiet on a no-change update, credits_granted (dedupe by invoice), cancel scheduled / reverted / canceled, low credits once with billing link, trial_ending + credits_expiring once per grant, paused upstream + failed to the creator. 8/8.
- ✅ Cleanup: test user deleted (cascade), test announcements, joined rows and the manual test list removed; prod tables back to 0 notifications. One side effect: the low-credits and list-finished test emails went to the CTO's Gmail aliases.

### Next (CTO)
1. **M10**: set `ADMIN_EMAILS=arun@preb.co,leon@preb.co` in Vercel Production (`docs/setup_manual.md`). Without it nobody sees the Admin group on prod.
2. Deploy; open the bell on preb.co, send a first announcement from `/admin/notifications` (the composer previews the exact row).
3. Note: `notFound()` pages stream with HTTP 200 and the branded 404 body (same for `/admin/ops`); harmless, flagged for a later pass.

---

## Featurebase support chat — 2026-10-08 · messenger on every page, identified in the app

### Done
- ✅ `featurebase-js` + `jose`. `FeaturebaseRoot` (`components/foundations/featurebase/featurebase.tsx`) wraps the app in `app/providers.tsx`: anonymous messenger everywhere (ready for the website), theme follows the in-app toggle.
- ✅ `(app)/layout.tsx` mints an HS256 identity token per render (`lib/featurebase/jwt.ts`: user id, email, name, avatar, role, member since; workspace as Featurebase company with plan, monthly spend, credits available, trial flag, subscription status, Stripe customer id, period end) and mounts `<FeaturebaseIdentity>`; unmount (logout, lost session) shuts the messenger down and reboots it anonymous. The SDK's Provider never clears identity on its own, so this lives in our wrapper.
- ✅ Account menu: Help center opens the messenger, Share feedback opens the composer (mailto links gone); Log out calls `shutdown()` before the server action.
- ✅ `npm run lint` ✓ (2 upstream warnings) · `npm run typecheck` ✓ · `npm test` ✓ (61).

- ✅ **Fix**: the wrapper imported `whenReady`/`boot`/`update` from the package root, but `featurebase-js/react` inlines its own SDK copy with separate state, so the token was never sent. The wrapper now uses only the React entry: identity through the Provider's `featurebaseJwt` prop, logout via `shutdown()` and a Provider remount (rendered beside the app so the page tree is not reset).
- ✅ **Root cause of "anonymous leads with random names"**: the Free plan refuses the SDK's separate `identify` action ("Identify functionality is available starting from the Growth plan"), but accepts identity inside the **boot** call. The old Preb app (`~/Documents/GitHub/preb`, `components/app/featurebase/featurebase-widget.tsx`) only ever mounts the Provider once the JWT exists, so it boots identified. The wrapper now does the same: every identity change is shutdown → fresh Provider mount keyed by the token. The Provider's own post-boot `identify` still logs the Growth warning on every load; it is noise, the boot already carried the identity.
- ⚠️ Custom attributes (role, plan, credits …) remain Growth-only and are dropped on Free; built-ins (name, email, user id, avatar, company id/name/monthlySpend/createdAt) go through.

### Next (CTO, `docs/setup_manual.md` M9)
1. ✅ `FEATUREBASE_JWT_SECRET` set locally and in Vercel. Send one message from a signed-in non-admin account and confirm the inbox shows name, email and the workspace as company.
2. Verify identification with a non-admin account (Featurebase SSO skips organisation admins).
3. Check the launcher loads with Termly cookies rejected.

---

## Responsiveness pass — 2026-10-08 · every click reacts at once

### Done
- ✅ **Root causes** (measured on a local production build with a timer-free MutationObserver; Chrome throttles `setTimeout` to 1 s in background tabs, so timer-based numbers are wrong): opening Settings by `router.replace(?settings=…)` re-rendered the server layout + page (5–9 Supabase hops) before the modal could appear (**843 ms** → now **11 ms**); `ButtonLink` was a plain `<a>` so header "New list", credits "Buy credits"/"Manage", paused "Buy credits" and empty-state CTAs did **full page reloads** (now client navigations, **8 ms** prefetched); header tabs waited for the server before the underline moved (now **2 ms**, optimistic + prefetch).
- ✅ `settings/use-settings-url.ts`: settings state still lives in the URL (`?settings=page&plan=1&short=N&checkout=…`, emails deep-link unchanged) but is updated with `window.history.replaceState`, which the Next router feeds to `useSearchParams` without a server round trip (Next docs: Native History API). All entry points (account menu, credits menu, paused panels, wizard/Enrich shortfall, plan switch) use it and **stay on the current page** (the account menu no longer jumps to /lists).
- ✅ `ButtonLink` renders `next/link` for internal routes (plain `<a>` for `/api/`, downloads, mailto, `_blank`).
- ✅ `getSessionContext`: profile + memberships in parallel; `getCreditSummary` reuses the session balance instead of a second `credits_available` RPC (one to two fewer hops per render and per server action).
- ✅ Feedback: Log out keeps the menu open with "Logging out…"; Enrich search/pagination run in a transition and dim the table; profile field dims while saving; modal exit 200 ms.
- ✅ Removed `router.refresh()` after actions that already `revalidatePath` (list dialogs, members, profile, manual enrichment); list actions now revalidate the `/lists` layout scope so detail pages update too. Termly re-initialises on route changes only. Skeletons: `(app)/loading.tsx`, `lists/new/loading.tsx`.
- ℹ️ Checked: Supabase JWKS serves an ES256 key, so the proxy's `getClaims` verifies locally (no auth network call per request). Vercel and Supabase are both us-east-1.

## Plan picker redesign — 2026-10-08 · premium layout, no nested popup

### Done
- ✅ **Picker lives inside Settings › Billing** (`billing/plan-picker.tsx`, `plan-picker-dialog.tsx` deleted): "Choose a plan" / "Change plan" swaps the Billing content for the picker; the modal title row shows a back arrow + "Choose a plan"; Escape goes back first, then closes. URL-driven: `?settings=billing&plan=1` (credits dropdown, paused panels, emails) and `&short=N` for the shortfall line. Wizard step 3 and the Enrich form now push that URL instead of mounting their own dialog (the modal is portalled from the layout, so wizard/form state survives Cancel).
- ✅ **Layout**: stats row of three aligned figures (Credits / month · Price /month · Per credit, captions above, values on one baseline, annual adds "billed yearly · save $X"), slider with tick labels below the track, "what one credit buys" as an aligned definition list (work email / personal email / mobile / rollover), CTA "Continue to checkout · $36.50/month" or "Review change"; confirm step uses the same card style.

## Enrich tab (manual single-contact enrichment) — 2026-10-08

### Done
- ✅ **New top-level tab `Enrich`** (`/enrich`, CTO requirement for the trial): type in up to **25 contacts** (LinkedIn URL, or first name + last name + company domain), pick Work email / Personal email / Mobile phone, live credit estimate, one click to start. The same page lists **every manually enriched contact** of the workspace (newest first, search, pagination, Download CSV), with skeleton cells while a run is in flight (5 s polling + realtime on `lists`).
- ✅ **No engine change.** A manual run is a normal `lists` row with **`source = 'manual'`** (migration `0013_manual_lists.sql`, applied via MCP, types patched). It goes through `normaliseRows` → cache lookup → `list_contacts` → `queueList` (hold, `queued`, `runTick`) exactly like a CSV list; FullEnrich bulk accepts 1–100 contacts. `src/lib/lists/actions.ts`: `insertContacts` and `queueList` extracted from `parseList`/`startList` (no behaviour change), new `startManualEnrichment`, `manualListName` ("Jon Snow + 2 more").
- ✅ Manual runs are **hidden from the Lists tab** (`getLists` filters `source = 'csv'`); the list detail page and per-list export still work for them. Lists empty state links to "Enrich a single contact".
- ✅ Shared bits: `lib/credits/fields.ts` (`FIELD_CARDS`), `lib/lists/export-columns.ts` (Preb CSV columns, used by both exports), `EmailCell`/`PhoneCell`/`StatusCell` exported from `contacts-table.tsx`. Header tabs now render on all screen sizes.

## Pricing v2 — 2026-10-08 · 2× credits, USD catalogue, trial 50 (complete; EUR→USD revert needs deploy)

### Done
- ✅ **Management pricing table analysed**: every Preb tier = 2× the FullEnrich credits at 1.25× the FullEnrich price rounded up to the next $0.50 (≥ 20 % margin). The margin sits in the credit unit — **1 Preb credit = ½ provider credit** — so the visible per-credit price ($0.037 → $0.022) undercuts the provider's ($0.058 → $0.035) while every action costs 2× (work email 2, personal email 6, mobile 20, reverse 2). FullEnrich's live pricing (per-action costs and the annual ladder) verified on fullenrich.com and a 2026-09-28 third-party capture; identical to `docs/fullenrich.md`.
- ✅ `lib/fullenrich/mapping.ts`: `UPSTREAM_CREDIT_COST` (1/3/10/1), `CREDIT_MULTIPLIER = 2`, `CREDIT_COST` derived, `toPrebCredits()`; `lib/jobs/results.ts` converts the authoritative batch `cost.credits` once where it is stored (`raw.cost` keeps the provider number); `lib/jobs/daily.ts` divides the largest hold by the multiplier before comparing with the provider balance; ops tile relabelled "Provider balance (provider credits)".
- ✅ `lib/credits/plans.ts` re-cut (USD, see revert below): 11 monthly (`p2_1k_m` 1,000 cr $36.50 … `p2_200k_m` 200,000 cr $4,375) + 11 annual (`p2_12k_y` 12,000 cr $390 … `p2_2400k_y` 2.4M cr $47,250), prices literal in USD cents, `MARGIN_MULTIPLIER` / `planPriceCents` removed, names "Preb 1k" … (v1 "Pro …" names stay readable in old ledger notes). New `lib/credits/money.ts` (`formatUsd`, `formatUsdExact`, `formatUsdFine`, `en-US`) replaces the four ad-hoc formatters; plan picker shows **$/credit** in the headline next to $/month, slider has 12 stops (phone shows every third label), "More than 200k credits"; Settings › Billing shows "… per credit".
- ✅ Trial 25 → 50: migration `0012_pricing_v2.sql` (new `handle_new_user`; one-off ×2 of `credit_grants.amount/remaining`, `credit_holds.amount`, `credit_ledger.delta`, `list_contacts.credits_cost`, `enrichment_batches.credits_cost`, `lists.credits_*`; clears v1 `pro_*` plan links; guarded by a marker row `webhook_events(provider='migration', external_id='pricing_v2')`); fallbacks in `queries.ts` / `settings-billing.tsx`; welcome email copy "Two credits per work email, six per personal email, twenty per mobile number".
- ✅ `scripts/stripe-catalogue.ts`: currency constant (now USD), prices from `plan.priceCents`, products found via `products.list` (search is eventually consistent — the first run's products were invisible to the second and 21 duplicates appeared; now deduplicated by lookup key), retires everything tagged `app=preb` that is not in `PLANS` (unset `default_price` → deactivate prices → archive product). **Test mode synced and verified**: 22 active Preb products, one lookup-keyed EUR price each (`preb_p2_*`), 14 v1 USD products + 21 duplicates archived, test subscription `sub_1UNw0i…` canceled.
- ✅ Tests updated/added (`mapping`, `results`, `webhooks` with `p2_*` keys and a guard that `preb_pro_*` never resolves, new `plans.test.ts` asserting 2× credits, ≥ 1.25× price on a 0.50 grid and annual/monthly alignment).
- ✅ Docs: `implementation_plan.md` (§ Decisions, § Credits & pricing with the v2 table, env list, § Changes), `fullenrich.md`, `product_mvp.md`, `screens.md`, `setup_manual.md`.

- ✅ **Annual prices signed off by CTO.**
- ✅ **Migration 0012 applied** to the shared Supabase project. Grants remaining 1,289 → 2,578, ledger Σ 1,289 → 2,578, trial trigger grants 50, marker row present. Incident: `lists.credits_used` came out 4× (564) because the counters trigger had already re-derived it from the doubled `list_contacts.credits_cost` before the explicit doubling ran. Fixed with `recompute_list_counters()` on every list (now 282 = 2×141, 0 lists out of line) and the migration file no longer doubles `credits_used`.
- ✅ **Live Stripe catalogue** (MCP, `app=preb` objects only): 22 products + prices (first EUR, now USD) with lookup keys `preb_p2_*`, descriptions and default prices set, all 22 verified via `prices.list({lookup_keys})`. The 14 v1 USD products (`prod_VP2…`) archived and their prices (`price_1UOEh…`) deactivated; `preb_pro_*` keys no longer resolve. Old Pre app objects, webhook `we_1UOEiO…` and portal config untouched.

- ✅ **Deployed by CTO; plan picker checked on preb.co (desktop).** Monthly 1k: "1,000 credits / month · $36.50 /month · $0.037 / credit", per-action lines 2 / 6 / 20 credits. Annual 12k: "$32.50 /month · $0.033 / credit · $390 billed yearly · save $48". `MARGIN_MULTIPLIER` confirmed absent from Vercel.
- ✅ Fix: the end-hugging "Contact us" tick (">200k" / ">2.4M") overlapped the last tier label with 12 stops → now a compact "+" (the headline still reads "More than 200k credits"). Verified by previewing the label in the live dialog; needs a redeploy.

- ✅ Redeployed; CTO confirmed the phone-width picker (Preb 2k: $69 /month, $0.035 / credit, labels 1k · 2k · 3k · 20k · 100k without overlap).

- ✅ Plan picker preselects the smallest tier of the shown interval when nothing is picked (no plan yet): headline and "Continue to checkout" are ready on open, and the default follows the Monthly / Annual toggle. Derived in render (`picked = selected ?? plans[0]`), no extra effect. Subscribers keep the "next tier up" preselection. Needs a redeploy.

---

- ✅ **Currency reverted EUR → USD (CTO, 2026-10-08).** The management table was written in €, and the agent switched the currency without asking; the CTO decided prices stay in dollars with the same numbers ($36.50 … $4,375 /month, $390 … $47,250 /year). Code: `money.ts` USD/`en-US`, catalogue script `CURRENCY = "usd"`, comments. Stripe test: script swapped all 22 prices. Stripe live (MCP): 22 new USD prices took over the `preb_p2_*` lookup keys (`transfer_lookup_key`), set as product defaults, the 22 EUR prices deactivated; no EUR purchase had happened. **Production shows "€" next to USD prices until the next deploy.**
## Backlog — 2026-10-08 (late) · backlog closed (no code changes)

### Done
- ✅ CTO confirmed the previous session's code (reverse cache fill, stale-cookie fix, live-update catch-up, Identified card) is **deployed to `preb.co`**.
- ✅ **Backlog cleared by CTO decision**: Sentry source maps and the legal pages (`/terms`, `/privacy`) are moved out of this repo's backlog — both will be done in the separate website / landing-page project. Until then the login-footer links and the Stripe portal Terms/Privacy URLs still 404 (public prefixes stay in `src/utils/supabase/proxy.ts`; Sentry stays DSN-less via `instrumentation*.ts`).
- ✅ `npm run lint` ✓ (2 upstream warnings) · `npm run build` ✓.

### Next
1. **CTO**: top up FullEnrich credits before inviting customers.
2. No open backlog in this repo. New sessions start from a CTO-provided bug or feature request; the website project owns Sentry source maps and the legal pages.

---

## Backlog — 2026-10-08 (night) · reverse rows pre-filled from the same-workspace cache at parse time (complete, verified on localhost)

### Done
- ✅ **`parseList` now serves email-only rows from the cache**: rows whose email was identified in this workspace in the last 90 days (cache rows tagged `fields = ['reverse']`) are inserted as `status cached`, `kind reverse`, `skip_reason null`, with the profile columns filled (names, title, company, location, LinkedIn) at 0 credits — no opt-in, no provider call. Enrichable rows keep the old behaviour; the lookup now also reads `fields` so an enrich row never takes a reverse record and vice versa (hash prefixes `em:` / `li:` / `nc:` already keep them apart; the check is belt and braces).
- ✅ `ParseSummary` gains `cachedReverse`; `emailOnly` excludes those rows, so the step-3 estimate and the reverse opt-in only cover rows that still need the lookup. Both cache fills use the new pure `cachedContactPatch()` in `lib/jobs/results.ts` (= `contactPatchFromRecord` + `status cached`, cost 0) instead of a hand-written column list → 1 new test, **49 tests**.
- ✅ Step 3 (`step-configure.tsx`): "Email-only rows" section also appears when only cached identifications exist ("N email-only rows were already identified in this workspace and are included for free"); the opt-in card is hidden when nothing is left to identify; the rows line shows "· N already identified (free)". A list served entirely from the cache can now be started (`allCached`): `startList` accepts `pending 0 / reverse 0` when cached rows exist, skips the credit hold at a 0 estimate, and `finalizeList` completes the list on the next tick (this also fixes the old all-cached *enrich* list, which used to fail with "There is nothing to enrich").
- ✅ **Login loop for stale cookies fixed**: a cookie whose claims verify (proxy) but whose user no longer exists (`getUser()` null — deleted account or a cookie from another environment) looped `/lists → /login → /lists` (proxy bounces signed-in users off `/login`). The app layout now redirects such requests to `GET /auth/signout`, which clears the cookie and lands on `/login`. Hit on localhost with a leftover dev cookie; it would happen on prod for a deleted user too.
- ✅ `npm test` 49 ✓ · `npx tsc --noEmit` ✓ · `npm run lint` ✓ (2 upstream warnings) · `npm run build` ✓.

### Verified on localhost (CTO signed in)
- ✅ CSV `Email,Note` with the two cached emails + `fresh.person@nowhere.test` → Email auto-mapped → step 3: "1 row has an email address … 2 email-only rows were already identified in this workspace and are included for free", opt-in card for the 1 remaining row, rows line "0 enrichable rows · 2 already identified (free) · 1 email-only", estimate ~1 credit.
- ✅ Opt-in turned off → "Typically ~0 credits", Start enabled → list `completed` by the in-process tick (`finalize.list processed 2 creditsUsed 0`). DB for both test lists: 2 rows `cached / reverse / cost 0` with names, 1 row `skipped / email_only`, `credits_estimated 0`, `credits_used 0`, no hold, no batch, `identified_rows 2`, balance unchanged (1264). Table shows names, titles, companies, locations; filter rail "Already enriched (free) 2".
- 🐞 **Fixed during the test**:
  - `list-stats.tsx`: the 4th card showed "Personal emails" for a list with identified rows but no reverse opt-in → now "Identified" when `identified_rows > 0` (and no phone/personal fields).
  - `list-detail.tsx`: an all-cached list finished before the realtime channel was open, so the page stayed on "Queued" until a reload (the 5 s poll is paused in background tabs). Now one `router.refresh()` when the channel reports `SUBSCRIBED`, and one when a background tab becomes visible. Re-tested: the second list flipped to Enriched without a reload. This likely also explains the day-7 "Queued · 0/4 for ~40 s" note.
- Not run: the opt-in **on** path for the fresh row (real reverse call; the webhook cannot reach localhost without the tunnel, M6). Unchanged engine code from day 7.
- Test data left in the CTO workspace: two lists named "reverse-cache" (0 credits). Delete them from the lists dashboard when convenient.
- Final checks: `npm test` 49 ✓ · `npx tsc --noEmit` ✓ · `npm run lint` ✓ (2 upstream warnings) · `npm run build` ✓.

### Next
1. ~~**CTO**: deploy~~ (done, see entry above); top up FullEnrich credits before inviting customers.
2. ~~Backlog: Sentry source maps · marketing/legal pages~~ → moved to the website project (see entry above).

---

## Backlog — 2026-10-08 (evening) · onboarding for workspace-less users (complete, verified on prod)

### Done
- ✅ **Login loop fixed**: a signed-in user with no workspace (member removed from their only one) used to hit `(app)/layout` → `/login` → proxy → `/lists` → … forever. Now the app layout sends a signed-in user without a workspace to `/onboarding`; anonymous users still go to `/login`.
- ✅ **`/onboarding` moved to `src/app/(auth)/onboarding`** (logo + footer shell, no header) because the app shell cannot render without a workspace. Two modes in `onboarding-form.tsx`: `first_login` (unchanged copy, owners rename the trigger-created workspace) and `no_workspace` ("Create a workspace" — explains the user is no longer a member and can create their own or ask for a new invite).
- ✅ **`completeOnboarding`** now works from the profile instead of the session: with a session it behaves as before; without one it calls `lib/workspace/create.ts: createOwnWorkspace()` (service role: workspace + owner membership + `default_workspace_id`, slug like the signup trigger, **no trial** — trials are granted once at signup so a removed invitee cannot farm credits). A membership appearing meanwhile (double submit / new invite) → skip creation, go to `/lists`. Welcome email still sent once (`trialCredits` 0 in this path).
- ✅ New `lib/workspace/naming.ts` (`suggestWorkspaceName` mirrors the trigger: company part of a work domain, "<first name>'s workspace" for free-mail; `workspaceSlug`) with 4 tests → **48 tests**.
- ✅ Self-leave in Members ("You left the workspace" → `/lists`) now lands on `/onboarding` when it was the user's only workspace; otherwise the fallback default workspace applies as before.
- ✅ `npm test` 48 ✓ · `npx tsc --noEmit` ✓ · `npm run lint` ✓ (2 upstream warnings) · `npm run build` ✓. Note: a stale `.next/dev/types` (from an earlier dev server) referenced the old onboarding path and failed the build's type check; deleted (regenerated by `next dev`).

### CTO test on prod (deploy with the first version of this change)
- ✅ Removed member → magic-link sign-in → `/onboarding` "Create a workspace", prefilled name → submit created the workspace (`ar.gupta494+invite's workspace`, owner, no trial, `onboarded_at` set).
- 🐞 **After submit: blank, flickering `/lists`.** Supabase edge logs: the `/lists` page (session, lists, members, credits queries) was re-fetched 2–3×/s for minutes from that tab; no `/onboarding` or action re-runs in between, no errors. Opening `preb.co/lists` in a fresh tab as the same user rendered normally. So the client router looped after the server-action `redirect("/lists")`, which crosses from the `(auth)` layout group into `(app)`. Root cause inside Next not pinned down (could not reproduce: resetting the test account needs a DB write the agent's permissions block).
- ✅ **Fix**: `completeOnboarding` returns `{ status: "done" }` instead of calling `redirect()`; `onboarding-form.tsx` then does a full `window.location.assign("/lists")` (lint rule suppressed on purpose). The app shell renders from a fresh tree. Lint · tsc · 48 tests · build green. **Needs a deploy + retest by the CTO.**
- Retest recipe (CTO, SQL in the Supabase dashboard — deletes only the empty test workspace): `update public.profiles set default_workspace_id = null, onboarded_at = null where email = 'ar.gupta494+invite@gmail.com'; delete from public.workspace_members where workspace_id = '2576bc80-2839-43a4-b7bd-8b8b05180050'; delete from public.workspaces where id = '2576bc80-2839-43a4-b7bd-8b8b05180050';` then reload `preb.co/lists` as that user → onboarding → submit → expect the lists dashboard after one full reload.

### Earlier note (superseded by the test above)
- No workspace-less user existed in the DB (all 3 profiles have one membership). **CTO test**: in Settings → Members remove `ar.gupta494+invite@gmail.com`, then sign in as that address (magic link lands in the CTO inbox) → expect `/onboarding` "Create a workspace", prefilled "Ar.gupta494's workspace"; submit → `/lists` with an empty workspace, 0 credits, welcome email without the trial sentence. Re-invite afterwards if the member account is still needed for RLS tests (it will then have 2 workspaces).

### Next
1. ✅ **Retest on prod after the fix deploy** (agent reset the test account first): onboarding → submit → one full reload → empty lists dashboard, no flicker. DB: one owner membership, `onboarded_at` set, 0 grants, no trial. The `+invite` account now owns its own workspace; re-invite it to the CTO workspace if it is needed for RLS tests again.
2. **CTO**: top up FullEnrich credits before inviting customers.
3. Backlog (pick one per session): pre-fill reverse rows from the same-workspace cache at parse time · Sentry source maps (needs DSNs + auth token).

---

## Post-launch QA — 2026-10-08 (afternoon) · prod QA leftovers closed, phone-width fixes (code done, deploy pending)

### Done
- ✅ **Cancel webhook verified** in the DB: CTO workspace `plan_key` null, `subscription_status canceled`, `stripe_subscription_id` null, live customer kept, 4 grants, balance 1264 (the +500 from the refunded test purchase stays, as noted on launch day).
- ✅ **Export download on prod** from the real "Download All (1)" button: `launch-check.csv`, UTF-8 BOM, 4 original columns + 13 `Preb:` columns, the enriched row (`arun@preb.co` Valid, Enriched, 1 credit).
- ✅ **Magic-link sign-in on `preb.co`**: tested by the CTO, works.
- ✅ **Phone-width pass on prod (375 px, same-origin iframe since the Chrome window can't shrink)**: lists dashboard, list detail (stat cards 2×2, table, pagination), wizard upload step, billing modal, plan picker, members and profile modals.
- 🐞 **Fixed (3 phone-width defects, verified on localhost at 375 px)**:
  - `settings-rows.tsx`: `SettingsRow` stacks label over control below `sm` (was side by side → one-word-per-line label, field overlapping); `SettingsValueField` and the profile name `Input` are full width on phone, 202 px from `sm`.
  - `settings-members.tsx`: invite row — role select 104 px / button `flex-1` on phone ("Send invite" was clipped); member and pending-invite rows `flex-wrap` with `basis-40` name block + `ms-auto` controls, so the role select / Remove wrap under the name instead of covering the avatar. `settings-modal.tsx`: content padding `px-4` on phone, `px-8` from `sm`.
  - `plan-picker-dialog.tsx`: tick labels collided ("500/750", "10k/>10k"); on phone the odd stops and the end-hugging `>10k` label are hidden unless selected (the `10k` label yields when "Contact us" is selected). Desktop unchanged.
- ✅ `npm test` 44 ✓ · `npx tsc --noEmit` ✓ · `npm run lint` ✓ (2 upstream warnings) · `npm run build` ✓.

### Next
1. **CTO**: deploy (push) so the phone-width fixes reach `preb.co`; top up FullEnrich credits before inviting customers.
2. Backlog (pick one per session): onboarding for workspace-less users (login loop) · pre-fill reverse rows from the same-workspace cache at parse time · Sentry source maps (needs DSNs + auth token).

---

## Go-live prep — 2026-10-08 · domain change to `preb.co` (code done) · deploy by CTO

### Decisions (CTO)
- Production domain is the apex **`preb.co`**, not `app.preb.co`. Framer is dropped; the marketing website will be built in this app later (post-MVP). Future legal URLs: `/terms`, `/privacy` (pages postponed, out of MVP scope).
- Vercel: **production environment only**, no preview for now. The agent gets no Vercel access (read-only MCP at most); the CTO does all Vercel/DNS/Stripe-live steps.
- Stripe goes **live** at launch; Sentry DSNs stay unset for launch.

### Done
- ✅ Pre-deploy checks on the day-7 tree: lint (2 upstream warnings) · tsc · 39 tests · build all green.
- ✅ Domain change: fallbacks `https://app.preb.co` → `https://preb.co` in `lib/email/templates/layout.tsx` (email links) and `scripts/stripe-portal.ts` (portal return URL). Auth footer links Terms/Privacy → relative `/terms`, `/privacy`; both added to `PUBLIC_PREFIXES` in `utils/supabase/proxy.ts` so visitors get the branded 404 instead of a login bounce until the pages exist. Everything else reads `NEXT_PUBLIC_APP_URL` (webhook URLs, auth redirects via `redirectOrigin()`), so no further code depends on the host.
- ✅ Docs: `setup_manual.md` M1 4a (Google origin `https://preb.co`), M2 4b (Site URL + redirect `https://preb.co/**`), M4 step 5 (live Stripe via MCP), M5 rewritten (apex domain, DNS off Framer incl. Resend records, production-only env list, deploy, crons); `implementation_plan.md` decision 4 + manual steps + Changes line; `fullenrich.md` webhook URL example.
- ✅ CTO rule: **`.env.local` is the single env source of truth**. `.env.example`, a short-lived `.env.production.local` and `scripts/vercel-env-push.sh` were deleted; the CTO enters production values in Vercel by hand.
- ✅ Re-verified after the change: lint · tsc · tests · build green.
- ✅ **Stripe live (M4 step 5) done via MCP** on the Preb.co live account: 14 products (`metadata.app=preb`, `plan_key`) + 14 prices with lookup keys `preb_<plan_key>` (same amounts as the sandbox, margin ×1.15) + default prices; portal configuration `bpc_1UOEiNI8j3KU4u56WUE4Nfuj` (`preb_managed`, not the account default); webhook endpoint `we_1UOEiOI8j3KU4u56RryzXz3O` → `https://preb.co/api/webhooks/stripe` (5 events). Secret handed to the CTO for the Vercel env. The old Pre app's live objects (products, two webhooks at `app.preb.co`, default portal config) were **not touched** — CTO rule: never delete them, the old app keeps running on `app.preb.co`.
- ⚠️ CTO status: Vercel domains added but `preb.co` currently 308-redirects to `www.preb.co` with `www` as production — must be flipped (apex = production). Google origin `https://preb.co` added (redirect URIs need nothing). Supabase redirect `https://preb.co/**` added; **Site URL still `localhost:3000`** → set to `https://preb.co`. Vercel env + deploy + real Checkout pending.

### Launch QA on https://preb.co (production deploy `662bc7e`, 2026-10-08 ~10:50 UTC)
- ✅ CTO: domains `preb.co` + `www.preb.co` both serve Production (no www→apex redirect yet, see Open), Supabase Site URL `https://preb.co`, 12 env vars in Vercel Production (optional ones use code defaults: `MARGIN_MULTIPLIER` 1.15, `UPSTREAM_LOW_BALANCE` 200, portal config found by metadata), redeployed.
- ✅ **Crons run**: Supabase edge logs show the tick's service-role queries every minute since 10:52 UTC (first minute after the deploy).
- ✅ Routes: `/` → `/login`; protected pages → `/login?next=…`; `/terms` → branded 404; HSTS on. Tick/daily without or with a wrong bearer → 401; Stripe webhook unsigned/bad signature → 400 (secret configured); FullEnrich webhook unsigned → 401.
- ✅ **Lighthouse on prod `/login`**: mobile perf 94 (LCP 3.0 s, CLS 0, TBT 0) · desktop 100 · a11y 100 · best practices 100 · SEO 92 (robots.txt redirected to login → fixed below).
- ✅ Stripe live endpoint `https://preb.co/api/webhooks/stripe` enabled; Resend `preb.co` verified; advisors unchanged (by-design WARNs only).
- 🐞 **Fixed (launch blocker)**: dev and prod share one Supabase DB, so the CTO workspace still carried the **sandbox** subscription (`sub_1UNw0i…`, active, `pro_500_m`). With the live key the picker would offer "Switch plan" and fail on Stripe. New `activeSubscriptionId()` in `lib/stripe/subscription.ts` treats an id that does not exist in the current Stripe mode (`resource_missing`) or is canceled as "no subscription" — **read-only, never clears the column**, so dev on the test key can't wipe a live subscription. Used by the plan picker, `startCheckout`, plan switch and the billing overview (foreign subscription → shown as no plan). Customers already self-heal (`ensureCustomer`). Tests: `subscription.test.ts` (5).
- ✅ `src/app/robots.ts` (allow `/login`, disallow app/api/auth/invite paths) + `/robots.txt` public in the proxy.
- ✅ After the fixes: lint (2 upstream warnings) · tsc · **44 tests** · build green. **Needs a push/deploy by the CTO.**
- ✅ CTO pushed the fixes (robots.txt live) and **deleted `www.preb.co`** from Vercel (it now 307s to the apex). Separate dev database: out of scope for now, comes with a future testing environment.
- ✅ **Signed-in QA on prod** (CTO signed in with Google on `preb.co`): lists dashboard (4 lists, header 765); Billing shows **Free trial + Choose a plan** (sandbox subscription correctly ignored), balance 765 with 3 grants; plan picker loads **live** prices (500/mo = $33), "Continue to checkout", no stale Current chip; `/admin/ops` healthy (0 stuck batches, 0 webhook problems, FullEnrich key valid).
- ✅ **Real list on prod** `launch-check` (1 row: the CTO at preb.co, work email only): upload → auto-map → configure (~1 credit) → start 11:04:01 → batch submitted 11:04:18 → FullEnrich contact webhook 11:05:11 + batch FINISHED 11:05:19 on `https://preb.co/api/webhooks/fullenrich`, both processed, no errors → `arun@preb.co` HIGH_PROBABILITY, batch cost 1 = contact cost 1 = ledger `consume −1`, hold released, list completed, page refreshed itself, "launch-check is enriched" email delivered with links to `https://preb.co/lists/…`.
- ⚠️ **FullEnrich account balance is ~89 credits.** One customer buying the smallest plan (500) and running a full list would drain it → lists go `paused_upstream` + ops email. Top up the FullEnrich plan before onboarding customers (M3 "500-credit plan purchase unconfirmed").
- ⬜ Not run on prod: export download (verified day 4), phone-width pass (Chrome window minimum), magic-link sign-in on the real host (Google used; Resend delivery verified via the list email).

### Manual tasks status
| Task | Status |
|---|---|
| M1 4a Google origin `https://preb.co` | ✅ |
| M2 4b Supabase Site URL + redirect `https://preb.co/**` | ⚠️ redirect added, Site URL still localhost |
| M3, M6, M7 | ✅ |
| M4 step 5 live Stripe (catalogue, portal, webhook → `preb.co`) | ✅ via MCP · real Checkout + refund ⬜ |
| M5 Vercel: domain `preb.co` + `www`, DNS (keep Resend records), production env, deploy, crons | ⬜ (project exists; CTO-only) |
| M8 Legal pages | postponed (post-MVP website) |

### Live purchase (CTO, 2026-10-08 11:12 UTC) — ✅ green
- Real Checkout Pro 500 monthly ($33): new **live** customer `cus_VP3KvVJIIpNQLr` (old sandbox customer replaced by `ensureCustomer`), subscription `sub_1UOFFjI8j3KU4u56p1yTj6kY` active, renews 2026-11-08; invoice `2RJDPVU2-0007` paid $33.00, `billing_reason subscription_create`, § 19 UStG footer present, no tax.
- 3 live Stripe events delivered to `https://preb.co/api/webhooks/stripe` and processed in < 1 s, no errors → grant +500 "Pro 500 · monthly" (expires 2027-01-08, tied to the invoice), ledger `grant +500`, workspace `plan_key pro_500_m` + live subscription id. Balance 764 → 1264.
- Refund notes: a refund does **not** cancel the subscription (it would renew and charge again on 2026-11-08) and the app has no refund handler, so the +500 credits stay. CTO cancels the subscription in Stripe as well (→ `customer.subscription.deleted` clears the plan).

### Open
- **Shared database**: dev (`.env.local`, Stripe test key) and production use the same Supabase project. Test-mode Stripe ids and sandbox credit grants (the CTO workspace's +500 "Pro 500" grant was paid with a test card) live next to real data; the FullEnrich key is the same real account in both. Recommend a separate Supabase project (or branch) for dev after launch.

### Next
1. **CTO**: refund the test purchase and cancel the subscription in Stripe; optional agent check that `customer.subscription.deleted` cleared the plan.
2. **CTO**: top up FullEnrich credits before inviting customers.
2. Optional backlog unchanged: onboarding for workspace-less users; Sentry source maps; pre-fill reverse rows from the same-workspace cache at parse time.

---

## Day 7 — 2026-10-07 · Reverse mode, QA (complete) · deploy pending (M5)

### Done (morning)
- ✅ **Reverse email lookup (F5)** as an opt-in for email-only rows inside a normal list (no separate list type): **migration 0009** (`list_contacts.kind enrich|reverse`, `lists.reverse_lookup`, `lists.identified_rows` counter, `claim_pending_contacts(..., p_kind)`, `recompute_list_counters` counts identified rows), applied via MCP, types patched.
- ✅ **Ingest**: `parseList` stores email-only rows as `skipped/email_only` with `kind = reverse`; a file with only emails is no longer rejected. `startList` gains `reverseLookup`: flips those rows to `pending`, sets `reverse_lookup` (and `mode = reverse` when the list has no enrichable rows), estimate = enrich estimate + email-only rows × 1 credit × 0.7 find rate (`REVERSE_FIND_RATE`); the row limit spans both kinds (enrich rows first).
- ✅ **Engine**: dispatcher runs one pass per contact kind (`CONTACT_KINDS`), batches never mix, `batch.kind` drives the endpoint (`startReverseEmailLookup`) and the result mapping. `mapRecord(record, kind)`: a reverse record is *found* when a profile came back (`isIdentified`), costs 1 credit, fills `first_name/last_name/full_name` from the profile (enrich records never overwrite the user's names). Cache write-through tags reverse results with `fields = ['reverse']`; cross-workspace cache serve works per kind. Webhook/reconcile unchanged (they pass the batch row, which carries `kind`).
- ✅ **UI**: Configure step (Figma 1015:43 re-pulled) gets an "Email-only rows" section with a `CheckboxCard` "Identify email-only rows · 1 credit" (on by default only when the list has no other rows); rows-to-enrich presets/limit/estimate include them; map step says "can be identified in the next step"; skip label "Email only (reverse lookup not selected)"; list stats show an **Identified** card for reverse-only lists.
- ✅ Tests: `mapping.test.ts` reverse hit/miss (+ no cross-charging). `npm test` 39 ✓ · `npx tsc --noEmit` ✓ · `npm run lint` ✓ (2 upstream warnings) · `npm run build` ✓.
- ✅ `get_advisors`: no new findings from 0009. Performance INFO "unindexed foreign keys" → **migration 0010** (4 covering indexes). Remaining WARNs are by design: `credits_available`/`is_workspace_*` are meant to be callable by signed-in users (0008 hardened `credits_available`); leaked-password protection is moot (no passwords).

### Reverse-lookup live E2E (afternoon, tunnel current)
- ✅ Mixed list `reverse-test` (1 enrichable + 3 email-only + 1 dup + 1 empty): map step 1/3/1/1, Configure shows the Email-only card; toggling it → rows 4, estimate ~3 (1×0.8 + 3×0.7) up to 4. Start → two provider batches (`enrich` ×1, `reverse` ×3), contact events applied one by one, batch FINISHED `cost.credits = 2` → ledger −2, hold released, balance 775 → 773, `identified_rows` 2, 1 reverse miss → `not_found`. Names/title/location/LinkedIn filled from the profile; table and export show them. The provider did not identify `gregoire@fullenrich.com` but did identify the two others.
- ✅ Reverse-only list `reverse-cache` (2 emails, no other columns): map step accepts 0 enrichable rows, Configure defaults the card on and needs no field, `mode = reverse`; both rows served from the **same-workspace cache** (free, status `cached`, no ledger row), completed within one tick; the page refreshed by itself.
- 🐞 Fixed on the way: Name cell falls back to the email while a reverse row is pending; Identified card counted only `enriched`, not `cached` (migration **0011**); Identified delta label.
- ⚠️ Once, the first run's page stayed on "Queued · 0/4" for ~40 s while the DB was already completed; a reload showed the finished view. Not reproduced on the second run (updated live). Likely the dev server recompiling after an edit mid-run; watch for it on the prod deploy.

### QA (afternoon)
- ✅ **Ledger math**: all settled batches have provider `cost.credits` = Σ contact `credits_cost` = Σ ledger `consume`; 0 `adjust` rows.
- ✅ **RLS two-workspace** (simulated with `set role authenticated` + JWT claims): the Gmx owner sees 0 lists / contacts / batches of the main workspace and `credits_available` = 0 for it; the invited member sees the main workspace (3 lists, 48 contacts) and nothing of Gmx.
- ✅ **Webhook replay**: `npm run qa:replay-webhook` (new `scripts/replay-webhook.ts`) re-posts the last stored batch event signed with the API key → `{ ok: true, duplicate: true }`, no ledger change; a bad signature → 401.
- ✅ **Reconcile**: a fake `submitted` batch with a bogus provider id, 20 min old → tick polled it (404 path) → `failed`, `credits_cost 0`, settled. Row released. Fake batch deleted afterwards.
- ✅ **Lighthouse** `/login` on the **dev server**: performance 69 (dev bundles are unminified; LCP 12.6 s is a dev artifact — re-run on the Vercel deploy), accessibility 92, best practices 100. Fixed the two a11y findings: toast viewport gets `role="region"` (aria-label on a plain div), auth captions/footer links moved from `text-text-tertiary` (2.6:1) to `text-text-secondary`.
- ✅ **50-row XLSX** (`qa-50.xlsx`: 5 real + 5 LinkedIn-only, 10 duplicates, 15 missing, 10 email-only incl. 3 dups, 5 junk): parsed as 12 enrichable · 13 duplicates · 7 email-only · 18 missing (SheetJS turned the `=HYPERLINK` cell into an empty cell and wrote the accented fixture names as mojibake — fixture artifacts, the CSV path shows accents correctly). Started with reverse on and **row limit 15** (estimate ~12, up to 15) — see below.
- ✅ **Row limit across kinds**: `qa-50` started with limit 15 → dispatcher sent 12 enrich + 3 reverse (two batches), `finalizeList` skipped the 4 remaining email-only rows as `row_limit`; header reads "0 / 15 contacts"; hold 12 (balance 773 → 761 while running).
- 🐞 **Start kick**: the `after()` kick in `startList` POSTed to `NEXT_PUBLIC_APP_URL/api/jobs/tick` through the tunnel; when the tunnel died (below) the list sat `queued` until a manual tick. It now calls `runTick()` in-process; the 1-minute cron stays the safety net.
- ✅ **Cron reconcile with the tunnel down (real, unplanned)**: the quick tunnel's hostname stopped resolving mid-afternoon while `cloudflared` kept running, so the two `qa-50` batches never received a webhook. Left alone for the reconciler (polls batches with no webhook after 15 min): at +15:40 the tick polled both batches (`polled 2, finished 2`) → enrich batch 12 records applied (9 work emails found, 3 not found; provider charged **8**, derivation said 9 → `adjust` note row, contact costs re-allocated to Σ 8), reverse batch 3 misses (0 credits), list `completed`, hold released, balance 773 → 765. Tunnel restarted afterwards (new URL in `.env.local`, Stripe endpoint re-pointed via `npm run stripe:webhook`).
- 🐞 **Fixed (pre-existing, surfaced by cache hits)**: `parseList` bulk-inserts rows where cache-hit rows carry `credits_cost`/result columns and plain rows do not; PostgREST sends NULL (not the column default) for keys missing in a mixed batch → `credits_cost NOT NULL` violation → "Could not store the rows" and the wizard stayed on Map. Only happens once the workspace has same-workspace cache hits, so it never showed before today. Fix: explicit `credits_cost: 0` on every row; insert failures are now logged (`parse.insert_failed`).
- ✅ **Dark mode**: Configure step incl. the Email-only card checked in dark (all semantic tokens). Dev server restarted by the agent during the hunt (CTO had allowed it); it now logs to the agent's scratchpad.
- ⬜ Export download, stop list, pause/resume on credits: not re-run today (verified day 3/4); phone-width pass still blocked by Chrome's minimum window.

### Manual tasks status
| Task | Status |
|---|---|
| M1–M4, M6, M7 | ✅ (M6 tunnel rotated again today: `https://alphabetical-checking-functions-songs.trycloudflare.com`) |
| M5 Vercel project + domain + env | ⚠️ pending — CLI not installed, env vars (`CRON_SECRET`, `STRIPE_WEBHOOK_SECRET`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, Supabase, FullEnrich, Resend), first deploy |
| M8 Legal pages (Leon) | ⬜ |

### Next: Go-live (needs the CTO)
1. **M5**: `npm i -g vercel`, `vercel link`, set env vars (prod + preview), `vercel --prod`; then Supabase redirect URLs (M2 step 4), Stripe **live** catalogue + webhook pointed at `app.preb.co` (M4 step 5; `npm run stripe:catalogue` / `npm run stripe:webhook` with live keys), Sentry DSNs.
2. After deploy: Lighthouse on the production URL (dev numbers are not representative), phone-width pass, `npm run qa:replay-webhook -- https://app.preb.co` (needs the prod service key locally — or skip), one real list end to end with the cron doing the dispatch (no `after()` kick needed).
3. Optional backlog: onboarding for workspace-less users; Sentry source maps; pre-fill reverse rows from the same-workspace cache at parse time; XLSX fixture with real formula cells.

### Open
- Reverse rows are not pre-filled from the same-workspace cache at parse time (the user has not opted in yet at that point); the engine serves them from cache after start instead.

---

## Day 6 — 2026-10-07 · Team, emails, polish (complete; invite E2E verified)

### Done
- ✅ **Settings › Members** `components/application/settings/settings-members.tsx` (nav row enabled in `settings-modal.tsx`, page key `workspace`; account menu gained a **Members** item): invite row (`Input` email + role `Select` Member/Admin + **Send invite**, Enter submits), members card (avatar, name · you, email, role `Select` for admins on non-owner rows, `Remove` / `Leave`; owner shown as a chip, fixed), pending invites card (role · expires, Expired chip, **Resend** / **Revoke**), `ConfirmDialog` for remove/leave/revoke. Members (non-admin) see the list read-only and can leave. Data via server actions on open, same pattern as Billing.
- ✅ **Server actions** `src/lib/workspace/actions.ts`: `fetchMembers`, `inviteMember` (owners/admins; rejects own address, existing members, invalid email; re-issues an existing pending invite with the new role; limits: 10 invites/h/workspace via `email_sends` + 10/h/address), `resendInvite` (fresh token + 7-day expiry, old link dies), `revokeInvite`, `changeMemberRole` (admin ↔ member only, never self/owner; RLS enforces the same), `removeMember` (self = leave; owner can't leave; resets the removed user's `default_workspace_id` to another membership or null).
- ✅ **Emails**: `templates/invite.tsx` (inviter, workspace, role, 7-day note) sent from `inviteMember`/`resendInvite`; `templates/welcome.tsx` sent once from `completeOnboarding` (first name, workspace, trial credits, CTA → `/lists/new`) — invitees skip onboarding and get no welcome (they got the invite). Copy of list-finished / list-paused / credits-low reviewed, unchanged.
- ✅ **Invite page**: an already-accepted invite whose user is a member now redirects to `/lists` (new users are joined by the sign-up trigger before they ever reach the page, so they used to see "no longer valid").
- 🐞 **Fixed (found in the E2E)**: `/auth/confirm` and `/auth/callback` redirected to `https://localhost:3000` behind the tunnel (`request.nextUrl.origin` is rebuilt from `x-forwarded-proto` + the internal host). New `lib/auth/origin.ts: redirectOrigin()` — localhost → plain http, configured app host → `NEXT_PUBLIC_APP_URL`, anything else → request origin. Callback's dev-only branch removed.
- ✅ **Error routes**: `app/(app)/error.tsx` (card with Try again (`retry`) + Your lists, shows the digest, reports to Sentry), `app/global-error.tsx` (inline-styled last resort), `app/not-found.tsx` (brand shell + empty state). Next 16 passes `retry`, not `reset`.
- ✅ **Sentry** `@sentry/nextjs` 11: `src/instrumentation.ts` (`register` inits only when `SENTRY_DSN` is set; `onRequestError = captureRequestError`), `src/instrumentation-client.ts` (`NEXT_PUBLIC_SENTRY_DSN`, `onRouterTransitionStart`). No `withSentryConfig`/source-map upload (v11 moved it; add on day 7 if needed). `.env.example`: `NEXT_PUBLIC_SENTRY_DSN`.
- ✅ **`/admin/ops`** `app/(app)/admin/ops/page.tsx`: `ADMIN_EMAILS` only (others get 404), service-role reads: FullEnrich balance, lists running, stuck batches (submitted > 30 min), webhook problems (errored or unprocessed > 10 min), paused/failed lists per workspace, last provider call, emails sent in 24 h by kind. Not linked from the UI.
- ✅ **Migration 0008** (`credits_available_membership`, applied via MCP): `credits_available(ws)` returns 0 for authenticated callers who are not members (service role unchanged) — day-1 advisor item.
- ✅ **Dark mode**: Members, Billing and the plan picker checked in dark (no raw colors). **Mobile**: Chrome here refuses windows < ~1000 px, so the 500 px check is by CSS review only: rail collapses to icons at `<sm`, invite row stacks (`flex-col sm:flex-row`), member rows truncate. Re-check on a phone on day 7.
- ✅ `npm run build` ✓ · lint ✓ (2 upstream warnings) · tsc ✓ · `npm test` ✓.

### E2E (sandbox, 2026-10-07 afternoon)
- Invite `ar.gupta494+invite@gmail.com` as member → email via Resend → first link was dead because the quick tunnel had rotated (`cloudflared` restarted: `.env.local` `NEXT_PUBLIC_APP_URL` updated, `npm run stripe:webhook` re-pointed the Stripe endpoint) → **Resend** sent a fresh link → CTO signed in with a magic link in incognito → sign-up trigger joined the workspace and marked the invite accepted → Members page shows 2 members, pending list empty → role Member → Admin → Member (toasts, RLS ok) → CTO confirmed the invitee sees the workspace lists through the tunnel. Test member left in place for the day-7 RLS two-workspace test.

### Open / notes
- A member removed from their only workspace has no workspace: `getSessionContext()` returns null and the app shell bounces to `/login` (loop). Acceptable for MVP (invited users always have the inviter's workspace); fix on day 7 if time: onboarding for workspace-less users.
- Ownership transfer is out of scope (owner role is fixed; RLS forbids changing it).
- Welcome email only for workspace owners (sent at the end of onboarding).
- Sentry env vars are unset locally; nothing is reported until `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` land in Vercel (M5).
- Quick-tunnel URL changed again today → whenever `cloudflared` restarts: update `NEXT_PUBLIC_APP_URL`, rerun `npm run stripe:webhook`.

### Manual tasks status
| Task | Status |
|---|---|
| M1 Google OAuth redirect URI | ✅ |
| M2 Supabase providers / URLs / secret key | ✅ |
| M3 FullEnrich account + API key | ✅ key; 500-credit plan purchase unconfirmed |
| M4 Stripe dashboard | ✅ test mode, webhook re-pointed to today's tunnel |
| M5 Vercel project + domain + env | ⚠️ CLI install, domain, env vars (incl. `CRON_SECRET`, `STRIPE_WEBHOOK_SECRET`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`), first deploy pending |
| M6 Local tunnel | ✅ (rotated today; see note) |
| M7 Resend domain check | ✅ |
| M8 Legal pages (Leon) | ⬜ |

### Next: Day 7 — Reverse mode (if on track), QA, deploy
0. Pending from day 6: none blocking. Optional: workspace-less user onboarding; Sentry source maps.
1. Morning: reverse email lookup mode (F5) — else defer.
2. Afternoon QA per plan: 50-row CSV with bad rows/duplicates/XLSX, ledger math vs `cost.credits`, webhook replay, cron reconcile with tunnel down, stop list, pause/resume on credits, **RLS two-workspace test** (use the `+invite` member: sign in as it in a second workspace), `get_advisors`, Lighthouse, phone-width pass of settings modal + plan picker.
3. Go-live: live Stripe catalogue + webhook, prod env (incl. Sentry DSNs), `vercel --prod`, Supabase redirect URLs (M2 step 4, M4 step 5, M5 step 6).

---

## Day 5 — 2026-10-07 · Billing (complete; full sandbox E2E verified)

### Done
- ✅ **Migration 0007** (`supabase/migrations/0007_billing.sql`, applied via MCP, types patched): `workspaces.subscription_status`, `cancel_at_period_end`, `low_credits_notified_at` + index on `stripe_customer_id`.
- ✅ **Stripe layer** `src/lib/stripe/`: `client.ts` (lazy singleton, `isLiveMode()`, § 19 UStG invoice footer), `catalogue.ts` (plans resolved by lookup key `preb_<plan_key>` in chunks of 10, cached 10 min; prices are the Stripe amounts, never computed), `checkout.ts` (`ensureCustomer` with `metadata.workspace_id` + invoice footer; subscription Checkout with billing address required, tax-id collection, promo codes, **no `automatic_tax`**), `portal.ts` (config by env `STRIPE_PORTAL_CONFIG_ID` or `metadata.preb_managed`; `switchPlanFlow` = portal `subscription_update_confirm` deep link), `webhooks.ts` (pure: `decideGrant`, `subscriptionPatch`, line/customer helpers; `STRIPE_EVENTS`).
- ✅ **Webhook** `/api/webhooks/stripe`: `constructEvent` signature, `livemode` must match the key, idempotent by `event.id` in `webhook_events (provider='stripe')`, 500 on processing errors so Stripe retries. `invoice.paid` → `grant_credits` (idempotent on invoice id): `subscription_create`/`subscription_cycle` = full plan, `subscription_update` = credit *difference* from the proration lines (upgrades only), expiry +3 m monthly / +12 m annual, resets `low_credits_notified_at`. `customer.subscription.created/updated/deleted` → `plan_key` (from the price lookup key), `subscription_status`, `cancel_at_period_end`, `current_period_end` (item level, API 2026-09-30); stale events for a replaced subscription are ignored. `checkout.session.completed` only links the customer.
- ✅ **Server actions** `src/lib/billing/actions.ts`: `fetchBillingOverview`, `fetchPlanCatalogue`, `startCheckout(planKey)` (owners/admins; new subscriber → Checkout, existing → portal switch-plan flow, prorated and invoiced immediately), `openBillingPortal`. `src/lib/billing/queries.ts` builds the overview (plan, subscription, grants with expiry, ledger last 50 through RLS, zero-delta reconciliation rows hidden).
- ✅ **Low-credit email** `lib/billing/low-credits.ts` + template `credits-low.tsx` (kind `credits_low`): after every charged settlement, when `available < 10 %` of the plan and not yet notified (flag claimed atomically; trials skipped — they get the paused email). Next grant resets the flag.
- ✅ **UI**: `billing/plan-picker-dialog.tsx` modelled on the upstream "Buy a plan" card (CTO request, end of day 5): `SegmentedControl` Monthly/Annual with "Save ~10 %", one BoardUI **`Slider`** (installed via MCP) across the 7 tiers plus a final ">10k / >120k" stop that turns the card into "Talk to us" (mailto sales@preb.co); headline shows credits / period · $/month (annual: billed-yearly total + saving) · Current chip; tick labels are clickable; meta row with rollover (3 / 12 months) and per-item prices derived from the plan ($/credit × 1 / 3 / 10). Primary button reads "Continue to checkout · 1.5k credits" / "Switch plan · …"; existing subscribers then get the confirm step. Tiers map by position between intervals. **Settings modal forked** (`settings/settings-modal.tsx`: pages Profile · Members (disabled, day 6) · Billing; title + subtitle; template pages General/Storage/Tools deleted; z-90 so dialogs stack above). `settings-billing.tsx` (plan card with status chip, renew/cancel date, **Manage billing** → portal, Change/Choose plan; balance card with `ProgressBar` + per-grant expiry rows; credit-history `Table` with list links). `settings-profile.tsx` rewritten against real data (name commits on Enter/blur via `account/actions.ts: updateProfileName`, email read-only). `settings-host.tsx` mounted in `(app)/layout.tsx` (Suspense): URL-driven `?settings=profile|billing`, `&plan=1` opens the picker, `&checkout=success|cancelled|switched` → toast + 3 delayed `router.refresh()`s so the webhook grant shows up without a reload.
- ✅ **CTAs**: credits dropdown → "Choose a plan / Buy credits" (`&plan=1`) + "Manage"; wizard shortfall banner opens the picker in place (copy warns the upload must be redone after Checkout — drafts are discarded on unmount, by design); paused-list panel → "Buy credits"; account menu Settings/Billing already used `?settings=`.
- ✅ **Scripts**: `npm run stripe:portal` (creates/updates the `preb_managed` portal configuration: customer update incl. tax id, invoice history, payment method, cancel **at period end** with reasons, switch among all 14 Preb prices with `always_invoice` proration, default return URL) and `npm run stripe:webhook [-- --rotate]` (creates/re-points the endpoint `${NEXT_PUBLIC_APP_URL}/api/webhooks/stripe` for the 5 events, prints `STRIPE_WEBHOOK_SECRET`). `.env.example` gained `STRIPE_PORTAL_CONFIG_ID` (optional).
- ✅ Bug fixed on the way: `lists-toolbar.tsx` rebuilt the URL from its own filters on every sync and dropped `settings`/`plan` (also fired once after mount under StrictMode) → it now preserves foreign params and only syncs when the search actually changed.
- ✅ Tests: `lib/stripe/webhooks.test.ts` (grant decisions for create/cycle/upgrade/downgrade/unknown, lookup-key mapping, subscription patch). `npm test` 37 ✓ · `npm run build` ✓ · `npm run lint` ✓ (2 upstream TanStack warnings) · `npx tsc --noEmit` ✓.

### Browser verification (Chrome, localhost, Stripe **sandbox**)
- ✅ `?settings=billing`: trial plan card, balance 25/25 with expiry row, credit history (+25 Welcome trial). Profile page shows real name/email.
- ✅ Plan picker: live prices from Stripe ($33 … $574/mo; annual $359 … $6,265 billed yearly with "save $…"), selection, Monthly→Annual keeps the tier (Pro 1k → Pro 12k), Continue enabled only with a selection.
- ✅ **Continue → Stripe Checkout** (sandbox): "Preb Pro 12k (annual) $676/year", promo code field, address + "I'm buying as a business" (tax id), email prefilled. Not paid (see pending).
- ✅ **Manage billing → Stripe customer portal** opened with the existing Preb configuration (headline, billing info, invoice history).
- ✅ Return URLs: `checkout=success` → toast "Payment received", `checkout=cancelled` strips the param; modal stays open.
- Side effect: a sandbox customer "Arun Gupta's workspace" now exists on your workspace row (`stripe_customer_id`), harmless.

### Sandbox E2E (agent, after the CTO registered the webhook) — 2026-10-07 afternoon
- ✅ **Checkout + grant**: Pro 500 monthly paid with test card 4242 → `checkout.session.completed`, `customer.subscription.created`, `invoice.paid` all 200 → +500 credits (`Pro 500 · monthly`, expires 2027-01-07), plan `pro_500_m` active, renews 2026-11-07. Billing page and header (525) updated without a reload.
- ✅ **Cancel / reactivate in the portal**: works after a fix (below). Billing page shows "cancels on Nov 7, 2026"; reactivating clears it. Subscription left **active** (not cancelling).
- ✅ **Low-credit email**: simulated with a temporary 490-credit hold → one `credits_low` email sent via Resend, second call suppressed by the flag. Hold removed and flag reset afterwards (balance 525, no open holds).
- ✅ 7 Stripe webhook events, 0 errors. `npm test` 38 ✓ · lint ✓ · tsc ✓.
- 🐞 **Fixed**: the portal schedules a period-end cancel via `subscription.cancel_at` (API 2026-09-30) and leaves `cancel_at_period_end` false, so the first cancel was not reflected. `subscriptionPatch` now treats either as scheduled (+ unit test).
- ✅ **Plan switch moved in-app** (the customer portal accepts at most 10 products; the catalogue has 14, so `npm run stripe:portal` failed with "A PortalConfiguration can display a maximum of 10 products"). New `lib/stripe/subscription.ts`: `previewSwitch` (`invoices.createPreview`, `always_invoice`, fixed `proration_date`) + `applySwitch` (`subscriptions.update`, same proration date, `payment_behavior: pending_if_incomplete` → 3-D Secure/failed payment keeps the old plan and returns the hosted invoice URL). Actions `previewPlanSwitch` / `confirmPlanSwitch` (owners/admins, quote valid 30 min). Plan picker gets a "Confirm plan change" step: charged today, unused time credited, credits added now. Portal script now sets `subscription_update: disabled` (portal = payment method, invoices, cancel at period end); the portal switch-flow helper was removed.
- ✅ **Upgrade verified**: Pro 500 → Pro 750 quoted **$16.00**, charged to the saved test card, `invoice.paid` (`subscription_update`) granted **+250** ("Upgrade to Pro 750", expiry +3 m), plan mirrored to `pro_750_m`.
- ✅ **Downgrade verified**: Pro 750 → Pro 500 quoted $0.00 today, $16.00 credited to future invoices, no credits added; plan mirrored back to `pro_500_m`, balance unchanged (775).
- 🐞 **Fixed**: the settings host cancelled its own post-return refresh timers (effect cleanup ran when the `checkout` param was stripped) — Billing/header now update by themselves after Checkout or a switch (verified on the downgrade).
- Final sandbox state: Pro 500 monthly, active, not cancelling, 775 credits, 11 Stripe events, 0 failed. `npm test` 38 ✓ · lint ✓ · tsc ✓ · build ✓.

### Decisions / notes
- `MARGIN_MULTIPLIER` left at **×1.15**, rounded to whole dollars (the sandbox catalogue was created with it; Annual ≈ 10 % under 12× monthly, mirroring the upstream). Change it in `.env.local` + `npm run stripe:catalogue` before the live catalogue on day 7 if you want different numbers.
- Plan changes happen in-app with an exact Stripe quote; upgrades are invoiced immediately (`always_invoice`) so credits arrive at once; downgrades grant nothing, keep existing credits and leave a Stripe customer balance. Cancel = at period end via the portal; credits keep their own expiry.
- Portal business-profile URLs point at `https://preb.co/privacy|terms` (Leon's pages, M8).
- Row selection / bulk actions and the Members page remain for day 6/7.

### Manual tasks status
| Task | Status |
|---|---|
| M1 Google OAuth redirect URI | ✅ |
| M2 Supabase providers / URLs / secret key | ✅ |
| M3 FullEnrich account + API key | ✅ key; 500-credit plan purchase unconfirmed |
| M4 Stripe dashboard | ✅ test mode, webhook live, full billing E2E passed (optional: rerun `npm run stripe:portal` to refresh headline/return URL) |
| M5 Vercel project + domain + env | ⚠️ CLI install, domain, env vars (incl. `CRON_SECRET`, `STRIPE_WEBHOOK_SECRET`), first deploy pending |
| M6 Local tunnel | ✅ (URL changes per restart → re-run `npm run stripe:webhook`) |
| M7 Resend domain check | ✅ |
| M8 Legal pages (Leon) | ⬜ |

### Next: Day 6 — Team, emails, polish
0. Nothing pending from day 5. (Optional: `npm run stripe:portal` now succeeds and refreshes the portal headline/return URL.)
1. Settings › Members page (members table with role `Select` + remove, invite row + pending invites with Resend/Revoke), invite acceptance E2E; enable the nav row in `settings-modal.tsx`.
2. Emails: `welcome`, `invite` on `EmailLayout`; review copy of list-finished/paused/credits-low.
3. Dark-mode + mobile pass (settings modal at 500 px, plan picker), motion polish, `error.tsx`/`not-found.tsx` routes, Sentry, `/admin/ops`.
4. Day-1 advisor item: membership check on `credits_available`.

## Day 4 — 2026-10-07 · List detail & export (complete, browser-verified)

### Done
- ✅ **List detail page** `(app)/lists/[id]/page.tsx` (+ `loading.tsx` skeletons): server component reads `?page&size&sort&dir&q&email&phone`, loads list (RLS + workspace check), one server-paginated contacts page and the ETA, and renders the client shell `components/application/list-detail/list-detail.tsx`. Drafts redirect to the wizard, foreign lists → 404.
- ✅ **Enriching view** (queued / enriching / stopping / paused_* / failed): `enrichment-progress.tsx` = controlled fork of BoardUI `AgentProgress` (steps *Validating rows · Submitting · Finding emails · Verifying deliverability · [Finding mobile numbers] · Finalising*, completed count derived from `submitted_rows` / `processed_rows`, paused state shows a static ring). `enriching-panel.tsx`: big count-up `128 / 415 contacts`, ETA from observed throughput (`getListEta`: settled non-cache batches, else processed/elapsed), rotating `AgentThinking` messages, "we'll email you" line, paused/failed copy. Table below with `Skeleton` cells for pending rows. **Live updates**: Supabase Realtime on the `lists` row + a 5 s `router.refresh()` poll while running (skipped when the tab is hidden, never stacked). Verified: counters and steps moved on their own after a DB update.
- ✅ **Completed view** (Figma 1015:31): `list-stats.tsx` (4 plain `StatCards`: Contacts · Valid · Risky · Mobile phones / Personal emails), `contacts-toolbar.tsx` (debounced search → URL, `/` shortcut, **Column settings** dropdown with checkbox rows incl. "From your file" pass-through columns, persisted in `localStorage` via `useSyncExternalStore` in `columns.ts`, Filters button < lg), `filter-rail.tsx` (Email status stacked bar `chart-1`/`chart-3` + Valid/Risky/Not found pills, Phone status Found/Not found, Duplicates removed, Already enriched; rail ≥ lg, BoardUI `Sheet` below), `contacts-table.tsx` (react-aria `Table` + TanStack for column plumbing, manual sort/pagination; columns Name (initials avatar + LinkedIn link) · Job title · Company (logo with fallback + domain link) · Location · Work email (`StatusDot` green/yellow + copy-on-hover) · Personal email · Phone (`Chip` Mobile/Landline + copy) · Status (Enriched / **Already enriched** for `cached` / Not found / Skipped · reason / Pending) · extra columns from `raw`; sticky Name column on horizontal scroll; footer with range, page-size `Select` 25/50/100, `Pagination`; inline `EmptyState`).
- ✅ **Header** `list-detail-header.tsx`: breadcrumb, click-to-rename title, status chip, credits-used pill (`credits_used`, now ledger-accurate), **Download** dropdown (All / Valid emails / Risky emails / Not found, disabled until done), Stop (running/paused), overflow Rename · Delete (→ `/lists`). Dialogs extracted to `list-card/list-dialogs.tsx` and shared with the dashboard card.
- ✅ **Export** `/api/lists/[id]/export?segment=all|valid|risky|not_found` (`lib/lists/segments.ts`, `lib/csv/export.ts`): session client (RLS), streams 1,000-row pages, BOM + CRLF, formula-injection guard, original columns in file order then `Preb: Work email / status / Personal email / status / Phone / Phone type / Job title / Company / Company domain / Location / LinkedIn URL / Status / Credits`; Status carries skip reasons (`stopped`, `row_limit`, `provider_lost`, `no_result`, `missing_fields`, `email_only`, `duplicate`). Segments match the rail: valid = DELIVERABLE/HIGH_PROBABILITY, risky = CATCH_ALL, not found = processed rows without a work email.
- ✅ Dashboard card: `EXPORT_READY` flag removed — **Download All** is a real `ButtonLink` (`download`) once the list is completed/stopped.
- ✅ Shared pure module `lib/lists/contact-query.ts` (query types, `parseContactQuery`, `SORT_COLUMNS`) so client components never import the `server-only` `lib/lists/queries.ts` (`getListContacts`, `getListEta`, `extraColumns`, `originalColumns`, `applySegment`).
- ✅ Tests: `lib/lists/contact-query.test.ts` (URL parser defaults/limits, CSV escaping + formula guard, file names, status mapping). `npm test` 29 ✓ · `npm run build` ✓ · `npm run lint` ✓ (2 upstream TanStack warnings) · `npx tsc --noEmit` ✓.

### Browser verification (Chrome, fixture lists seeded via SQL — 40 synthetic rows: valid/risky/not-found/cached/skipped, mobile + landline phones, 2 pass-through columns)
- ✅ Completed view: stat cards, filter pills (Risky → 5 rows, URL `?email=risky`), Reset, search "hopper" → 1 row, sort by company desc + 50/page via URL, column settings (core + "Notes"/"Source" from the file, Reset to defaults), Download menu with 4 segments, status chips incl. Already enriched / Not found, copy buttons on hover.
- ✅ Enriching view: progress steps, 5 / 12 count, "About 6 minutes left", skeleton cells for pending rows; after a DB update the page refreshed itself to 8 / 12 and advanced a step (realtime + poll).
- ✅ Dark mode; 500 px width: header collapses, panel stacks, Filters button opens the sheet, table scrolls horizontally with the sticky Name column, no page-level horizontal scroll.
- ✅ **CSV download verified by the CTO** on the fixture list "[QA] Day 4 fixture — completed" (delete it from the card menu if still present).

### Deviations / notes
- Not-found segment/filter is defined on the **work email** (processed rows with no work email), consistent with the card and rail counters; personal-email-only hits count as "not found" for email but still export.
- Column visibility is per browser (localStorage), as planned; no server persistence.
- Row selection checkboxes (Figma) were left out — nothing acts on a selection yet (bulk export of selected rows can come with day 7 polish).
- Reconciler/realtime: the browser subscribes to `postgres_changes` on `lists` only (publication from day 1); `list_contacts` is polled.
- `getListEta` uses `enrichment_batches` through RLS (members can select batches) — no admin client in the page.

### Manual tasks status
| Task | Status |
|---|---|
| M1 Google OAuth redirect URI | ✅ |
| M2 Supabase providers / URLs / secret key | ✅ |
| M3 FullEnrich account + API key | ✅ key; 500-credit plan purchase unconfirmed |
| Stripe sandbox key + test catalogue | ✅ |
| M4 Stripe dashboard | ✅ test mode connected to the Stripe MCP; no Stripe Tax (§19 UStG); portal + branding from the old Pre app |
| M5 Vercel project + domain + env | ⚠️ CLI install, domain, env vars (incl. `CRON_SECRET`), first deploy pending |
| M6 Local tunnel | ✅ (URL changes per restart) |
| M7 Resend domain check | ✅ |
| M8 Legal pages (Leon) | ⬜ |

### Next: Day 5 — Billing
0. M4 done. Billing decisions: no `automatic_tax` (Kleinunternehmerregelung); add the §19 UStG note to invoices; create a **Preb-specific portal configuration via API** (products/prices of the new catalogue, cancel at period end) instead of relying on the old Pre app default.
1. `lib/stripe/{client,checkout,portal,webhooks}.ts`, `/api/webhooks/stripe` (grants via `grant_credits`, upgrades, cancel), Checkout (subscription, tax, address), Portal config.
2. Plan picker `Dialog` (`SegmentedControl` monthly/annual, 7 plans from `lib/credits/plans.ts`), Billing settings page in the forked `settings-modal`, credits dropdown wiring, "Buy credits" CTAs (wizard shortfall banner, paused list panel, `/lists?settings=billing` links), low-credit email.
3. Decide `MARGIN_MULTIPLIER` (catalogue was created at ×1.15).

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
