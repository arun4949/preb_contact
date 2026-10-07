# Sprint progress log

Update at the end of every session. Newest day on top. Legend: ✅ done · ⚠️ partial · ⬜ not started.

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
