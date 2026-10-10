# Manual setup tasks (step by step)

These are the only tasks Claude Code cannot do through MCP. Tick them off as you go. Menu names are current as of Oct 2026; if a label differs, the setting lives in the same section. Never paste secrets into chat — put them in `.env.local` (gitignored) and say "done".

## M1 · Google Cloud Console — reuse the old Preb OAuth client · needed day 1

- [x] 1. Open [https://console.cloud.google.com](https://console.cloud.google.com) and select the project that holds the old Preb OAuth client. Go to **APIs & Services → Credentials**.
- [x] 2. Click the existing **OAuth 2.0 Client ID** (type "Web application").
- [x] 3. Under **Authorized redirect URIs** click **Add URI** and paste `https://zigocelujwbasujrozpk.supabase.co/auth/v1/callback`. Keep the old URIs.
- [x] 4. Under **Authorized JavaScript origins** add `https://app.preb.co` and `http://localhost:3000`. Click **Save**.
- [ ] 4a. (Go-live, domain change) add `https://preb.co` to **Authorized JavaScript origins**; `app.preb.co` can be removed. Save.
- [x] 5. Copy **Client ID** and **Client secret** (needed in M2 step 3).
- [x] 6. Open **OAuth consent screen**: app name "Preb", upload the new logo, publishing status must be **In production** (otherwise only test users can sign in).



## M2 · Supabase dashboard — providers, URLs, secret key · needed day 1 (step 4b on day 7)

- [x] 1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard) → project **preb-contact** (ref `zigocelujwbasujrozpk`).
- [x] 2. **Authentication → Sign In / Providers → Email**: keep *Enable Email provider* on (Supabase verifies the sign‑in token; it never sends the email — our app sends it through Resend). Set *Email OTP expiration* to 3600 s. Save.
- [x] 3. **Authentication → Sign In / Providers → Google**: toggle **Enable**, paste Client ID and Client secret from M1. Save.
- [x] 4. **Authentication → URL Configuration**: *Site URL* `http://localhost:3000` for now. Under *Redirect URLs* add `http://localhost:3000/`**, `https://app.preb.co/`** and your Vercel preview pattern `https://*-<your-team-slug>.vercel.app/**`. Save.
- [ ] 4b. (Go-live) change *Site URL* to `https://preb.co` and add `https://preb.co/**` to *Redirect URLs* (the `app.preb.co` entry can go; no preview environment for now, so the `*.vercel.app` pattern is optional).
- [x] 5. **Project Settings → API Keys**: reveal the **secret (service_role) key**, paste it into `.env.local` as `SUPABASE_SECRET_KEY`. Never commit. Tell Claude "done".

- Do **not** configure SMTP or email templates in Supabase. All emails (sign‑in link, invites, notifications) are designed in the app and sent via Resend; the sending key is already in `.env.local` as `RESEND_API_KEY`.



## M3 · FullEnrich — account & API key · needed day 1

- [x] 1. Sign up at [https://app.fullenrich.com](https://app.fullenrich.com) with a company email (50 free credits). Before day 3, buy the smallest Pro plan (500 credits, $29) so real enrichments and webhooks can be tested.
- [x] 2. **Settings → API** ([https://app.fullenrich.com/app/api](https://app.fullenrich.com/app/api)) → **Create API key**, name `preb-prod`. Paste into `.env.local` as `FULLENRICH_API_KEY`. Optional: set a consumption limit on the key as a spend guard.
- [x] 3. **Settings → Workspace**: enable **Personal email enrichment**. **Settings → Credits → Alerts**: alert at 20 %.
- [ ] 4. (Day 7) create a second key `preb-dev` for local testing.



## M4 · Stripe dashboard — items the API cannot toggle · needed day 5 (step 5 on day 7)

- [x] 1. Log in to [https://dashboard.stripe.com](https://dashboard.stripe.com) (account **Preb.co**). Switch **Test mode** on (toggle top right) while we build. Claude creates products, prices, portal configuration and webhooks via MCP in test mode first.
- [x] 2. ~~**Settings → Tax**: enable **Stripe Tax**.~~ **Dropped (CTO, day 4):** Preb runs under the German Kleinunternehmerregelung (§19 UStG), no VAT is charged, Stripe Tax stays off. Revisit if revenue passes the §19 thresholds.
- [x] 3. (Done from the old Pre app, CTO day 4.) **Settings → Billing → Customer portal**: verify *Business information* (name Preb, support email, Terms and Privacy URLs from Leon's site) and *Branding* (new logo, accent colour).
- [x] 4. (Done from the old Pre app, CTO day 4.) **Settings → Business → Branding / Public details**: upload the new Preb logo, set statement descriptor `PREB.CO`.
- [ ] 4a. (Day 5, test mode) In the repo: `npm run stripe:webhook` → paste the printed `STRIPE_WEBHOOK_SECRET=whsec_…` into `.env.local` and restart `next dev`. Re-run it whenever the tunnel URL changes (it re-points the endpoint; the secret stays). Then `npm run stripe:portal` to sync the Preb portal configuration (payment method, invoices, cancel at period end; plan switching happens in the app).
- [ ] 4b. (Day 5) Pay one sandbox Checkout (Settings › Billing › Choose a plan, card `4242 4242 4242 4242`, any future date/CVC) and confirm the grant appears in Settings › Billing and the header balance.
- [x] 5. (Go-live) Live catalogue, portal configuration and webhook endpoint (`https://preb.co/api/webhooks/stripe`) created by the agent through the Stripe MCP (live mode, 2026-10-08) — test-mode objects never carry over to live, which is why this step exists. The live `STRIPE_WEBHOOK_SECRET` goes into the Vercel env. You run one real Checkout with a real card and refund it. The portal config links Terms/Privacy to `https://preb.co/terms` and `/privacy` (pages come with the website, post-MVP).



## M5 · Vercel — project, domain, env · go-live (CTO only; the agent has no Vercel access)

Decision (go-live session, 2026-10-08): the app ran on the apex `preb.co`. **Superseded on 2026-10-10:** the marketing website moves to Framer (built by Leon) on `preb.co`, and the app moves to **`app.preb.co`**. Follow **M11** for the switch; the `preb.co` values in steps 2 to 6 below are historical. Production environment only; no preview environment.

- [x] 1. Vercel project created and linked in your team. The team needs the **Pro plan** (1‑minute cron jobs).
- [ ] 2. **Settings → Domains → Add** `preb.co`; also add `www.preb.co` and set it to redirect to `preb.co`. Vercel shows the DNS values (an **A** record for the apex, a CNAME for `www`).
- [ ] 3. DNS for preb.co: if the nameservers still point at Framer, move DNS to a provider you control (or Vercel DNS) first and **re-create the Resend records** (DKIM/SPF/return-path for `preb.co`, see M7) — otherwise outbound email breaks. Then add the A/CNAME records from step 2 and wait for the green check.
- [ ] 4. **Settings → Environment Variables (Production)**: every variable from `.env.local` with production values: `NEXT_PUBLIC_APP_URL=https://preb.co`, a fresh `CRON_SECRET` (`openssl rand -hex 32`), **live** `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (from M4 step 5), Supabase keys, FullEnrich key, Resend key, `EMAIL_FROM`, `ADMIN_EMAILS`, `OPS_ALERT_EMAIL`, `UPSTREAM_LOW_BALANCE`, `FEATUREBASE_JWT_SECRET` (M9) (`MARGIN_MULTIPLIER` is gone since pricing v2 — remove it if set). Sentry DSNs stay unset for launch.
- [ ] 5. Deploy to production (dashboard or `vercel --prod`). Then **Settings → Cron Jobs**: confirm `/api/jobs/tick` (every minute) and `/api/jobs/daily` are listed and enabled.
- [ ] 6. After the deploy: M1 step 4a, M2 step 4b, M4 step 5 (live webhook URL must be `https://preb.co/api/webhooks/stripe`).



## M6 · Local webhook tunnel · needed day 3

- [x] 1. `brew install cloudflared`.
- [x] 2. In a second terminal: `cloudflared tunnel --url http://localhost:3000`. Copy the printed `https://….trycloudflare.com` URL.
- [x] 3. Set it in `.env.local` as `NEXT_PUBLIC_APP_URL` and restart `npm run dev`. The URL changes every time the tunnel restarts. (`*.trycloudflare.com` is already allowed in `next.config.ts`.)
- [x] 4. After every restart also run `npm run stripe:webhook` (re-points the Stripe endpoint). **Quick tunnels can die silently**: the `cloudflared` process keeps running while the hostname stops resolving (seen day 7). Symptoms: provider webhooks stop arriving and lists sit in `queued`/`enriching`; the reconciler recovers batches after 15 min. Check with `curl -sI $NEXT_PUBLIC_APP_URL/login`; if it fails, restart the tunnel and repeat steps 3–4.



## M7 · Resend — one check

- [x] 1. Open [https://resend.com/domains](https://resend.com/domains) and confirm `preb.co` shows **Verified** (DKIM and SPF) and that the return‑path / MX record exists. Open and click tracking are already off. Claude created the sending‑only key through the MCP (`RESEND_API_KEY` in `.env.local`); add the same value to Vercel in M5 step 4.



## M7b · Brand assets for emails · done on day 2, repeat after a logo change

- [x] `npx tsx --env-file=.env.local scripts/upload-brand-assets.ts` uploads `public/logoName.png` and `public/logo.png` to the public Storage bucket `brand`; emails load the logo from there. Set `EMAIL_ASSET_BASE_URL` only if the assets move elsewhere (e.g. the Framer site).
- Sign‑up requires a work email. Founders/testers with personal addresses go into `ADMIN_EMAILS` (locally and in Vercel, M5 step 4).



## M8 · Legal (Leon, before launch)

- [ ] Privacy policy states: contact data is enriched from third‑party data providers; enriched data is retained until the customer deletes the list; processors are FullEnrich, Supabase, Stripe, Resend, Vercel, Sentry; US sales; deletion path (delete list in app, workspace deletion on request).
- [ ] Terms state: credits expire 3 months after grant (12 months on annual plans, trial 30 days); consumed credits are non‑refundable; personal email data may be used for recruiting outreach only.
- [ ] Send Claude the final URLs for Terms and Privacy — they go into the login footer, the signup consent checkbox, the Configure‑step notice and the Stripe portal configuration.

## M9 · Featurebase — support messenger identity · 2026-10-08

**Plan note:** identity must be passed in the SDK's boot call (the wrapper does this); the separate `identify` action and custom attributes are Growth-only. On Free the inbox shows name, email, avatar and the workspace as company, nothing else.

The messenger (app id `6a37abfc48ab5024a97ba42e`, constant in `src/lib/featurebase/config.ts`) boots on every page: anonymous on the website, `/login`, `/onboarding` and `/invite`, identified inside the signed-in shell through a server-signed JWT (`src/lib/featurebase/jwt.ts`).

- [x] 1. **Settings → Access & Security → Security**: copy the JWT secret into `.env.local` as `FEATUREBASE_JWT_SECRET` and into the Vercel Production env (M5 step 4). Unset = the messenger runs anonymous only and the server logs one warning.
- [ ] 2. **Settings → Users → Custom attributes** (user): `role` (text), `workspaceId` (text). **Companies → Custom attributes**: `planName` (text), `planKey` (text), `creditsAvailable` (number), `isTrial` (boolean), `subscriptionStatus` (text), `stripeCustomerId` (text), `currentPeriodEnd` (date). Attributes that are not declared are dropped silently.
- [ ] 3. **Security → Validate JWT**: paste a token from a dev render (temporarily `console.log` the result of `signFeaturebaseJwt`) and confirm the company shape is accepted (Featurebase docs name the company id key both `id` and `companyId`; the validator is the source of truth).
- [ ] 4. Test with a **non-admin** account: Featurebase SSO cannot identify users who are admins of the Featurebase organisation, so the CTO's own login stays anonymous in the messenger.
- [ ] 5. Termly runs with `autoBlock`. Confirm the launcher loads with cookies rejected; if the resource blocker holds `do.featurebase.app` back, allowlist it or mark it essential in the Termly dashboard.

## M10 · Admin allow-list for announcements · 2026-10-09

The notification center's admin dashboard (`/admin/notifications`, plus `/admin/ops` and the **Admin** group in the account menu) is gated by `ADMIN_EMAILS` only; nothing is hardcoded.

- [ ] 1. **Vercel → Settings → Environment Variables (Production)**: set `ADMIN_EMAILS=arun@preb.co,leon@preb.co` (comma-separated, case-insensitive). Redeploy. Locally `.env.local` keeps the Gmail test account.
- [ ] 2. Sign in on preb.co, open the account menu → **Admin → Announcements**, send a first announcement (the preview shows the exact row). Non-admins get the branded 404 on that URL.
- [ ] 3. Optional: `OPS_ALERT_EMAIL` still decides where ops emails go (falls back to the first `ADMIN_EMAILS` entry).

## M11 · Domain switch: website on preb.co (Framer), app on app.preb.co · 2026-10-10

Context: the in-app website was removed (the app's code no longer serves `/` as a marketing page; `/` redirects to `/lists` or `/login`). The app reads its own domain only from `NEXT_PUBLIC_APP_URL`; links to Terms and Privacy point to `https://preb.co/terms` and `https://preb.co/privacy` (constant in `src/lib/site-links`). Checked live on 2026-10-10: no open invites, no lists enriching, no open provider batches.

Do the steps in this order so sign-in, billing and webhooks never point at a host that is not serving the app.

**A · Free app.preb.co (the old Pre app still runs there)**
- [x] 1. Decide what happens to the old Pre app. In its Vercel project remove the domain `app.preb.co` (or move the old app to another subdomain).
- [x] 2. (Done 2026-10-10: old app retired, the agent disabled the three endpoints via MCP; they are not deleted.) The old app still has live webhooks on `app.preb.co` that will reach the new app once it moves: Stripe `https://app.preb.co/api/webhooks/stripe/billing` and `https://app.preb.co/api/integrations/stripe/webhook`, Resend `https://app.preb.co/api/webhooks/resend` (same path as Preb's, it will be rejected with 401 because the signing secret differs). If the old app is retired, disable those three endpoints yourself; if it moves, re-point them to its new host. (The agent never edits the old app's Stripe objects.)

**B · Bring the app up on app.preb.co**
- [x] 3. Vercel (new Preb project) → **Settings → Domains → Add** `app.preb.co`. If DNS shows a CNAME for `app` already pointing at Vercel, keep it; otherwise add the CNAME Vercel shows. Keep `preb.co` on this project for now.
- [x] 4. Vercel → **Environment Variables (Production)**: `NEXT_PUBLIC_APP_URL=https://app.preb.co` (`FULLENRICH_WEBHOOK_BASE_URL` is not set in Production and is not needed there). If `FULLENRICH_WEBHOOK_BASE_URL` is set in Production, change it to `https://app.preb.co` (or delete it; the app then uses `NEXT_PUBLIC_APP_URL`). Redeploy.
- [x] 5. Supabase → **Authentication → URL Configuration**: *Site URL* `https://app.preb.co`; *Redirect URLs* add `https://app.preb.co/**` (remove `https://preb.co/**` after step 12). Without this, magic links and Google sign-in on app.preb.co fail.
- [x] 6. Google Cloud Console → the OAuth client → **Authorized JavaScript origins**: make sure `https://app.preb.co` is listed (it was kept from the old app). The redirect URI stays the Supabase callback. In the **OAuth consent screen**, set the homepage to `https://preb.co` and the privacy policy to `https://preb.co/privacy`.
- [x] 7. Test on `https://app.preb.co`: magic-link sign-in, Google sign-in, open a list, Settings › Billing.

**C · Point the integrations at app.preb.co (agent can do 8 and 9 via MCP on request, right after step 7)**
- [x] 8. (Done by the agent 2026-10-10.) Stripe (live): update the Preb webhook `we_1UOEiO…` ("Preb app billing") from `https://preb.co/api/webhooks/stripe` to `https://app.preb.co/api/webhooks/stripe` (the signing secret stays the same). Update the Preb portal configuration `bpc_1UOEiN…` default return URL to `https://app.preb.co/lists?settings=billing`; its Terms/Privacy links stay on `https://preb.co`.
- [x] 9. (Done by the agent 2026-10-10.) Resend: update the Preb webhook `https://preb.co/api/webhooks/resend` to `https://app.preb.co/api/webhooks/resend` (keep the signing secret in `RESEND_WEBHOOK_SECRET`).
- [x] 10. Featurebase: add `app.preb.co` to the allowed domains of the messenger (and keep `preb.co` if Leon embeds it on the website). Termly: add `app.preb.co` to the website's domains so the consent banner keeps loading; the banner's "Legal Notice" link points to `https://www.preb.co/imprint`, which Framer must serve.
- [x] 11. Local dev: in `.env.local` change `FULLENRICH_WEBHOOK_BASE_URL=https://preb.co` to `https://app.preb.co` (local test enrichments send their webhooks to production, which then lives on app.preb.co).

**D · Hand preb.co to Framer**
- [ ] 12. Leon connects `preb.co` (and `www`) in Framer. When changing DNS for the apex: keep the **Resend records** (DKIM, SPF, return-path, MX on `preb.co`, see M7) and the `app` CNAME, otherwise email or the app breaks. Then remove `preb.co` from the Preb Vercel project.
- [ ] 13. Framer must publish `/terms`, `/privacy` and `/imprint` (the app login, the Stripe portal, the Google consent screen and Termly link there). Recommended Framer redirects for old bookmarks and emails sent before the switch: `/login`, `/lists`, `/enrich`, `/invite/*` → the same path on `https://app.preb.co`.
- [ ] 14. Enrichments started before step 12 send their provider webhook to `preb.co`; if any are running at the switch, the 15-minute reconciler recovers them, so no action is needed. Best to switch when no list is enriching.

