# Manual setup tasks (step by step)

These are the only tasks Claude Code cannot do through MCP. Tick them off as you go. Menu names are current as of Oct 2026; if a label differs, the setting lives in the same section. Never paste secrets into chat — put them in `.env.local` (gitignored) and say "done".

## M1 · Google Cloud Console — reuse the old Preb OAuth client · needed day 1

- [x] 1. Open [https://console.cloud.google.com](https://console.cloud.google.com) and select the project that holds the old Preb OAuth client. Go to **APIs & Services → Credentials**.
- [x] 2. Click the existing **OAuth 2.0 Client ID** (type "Web application").
- [x] 3. Under **Authorized redirect URIs** click **Add URI** and paste `https://zigocelujwbasujrozpk.supabase.co/auth/v1/callback`. Keep the old URIs.
- [x] 4. Under **Authorized JavaScript origins** add `https://app.preb.co` and `http://localhost:3000`. Click **Save**.
- [x] 5. Copy **Client ID** and **Client secret** (needed in M2 step 3).
- [x] 6. Open **OAuth consent screen**: app name "Preb", upload the new logo, publishing status must be **In production** (otherwise only test users can sign in).



## M2 · Supabase dashboard — providers, URLs, secret key · needed day 1 (step 4b on day 7)

- [x] 1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard) → project **preb-contact** (ref `zigocelujwbasujrozpk`).
- [x] 2. **Authentication → Sign In / Providers → Email**: keep *Enable Email provider* on (Supabase verifies the sign‑in token; it never sends the email — our app sends it through Resend). Set *Email OTP expiration* to 3600 s. Save.
- [x] 3. **Authentication → Sign In / Providers → Google**: toggle **Enable**, paste Client ID and Client secret from M1. Save.
- [x] 4. **Authentication → URL Configuration**: *Site URL* `http://localhost:3000` for now. Under *Redirect URLs* add `http://localhost:3000/`**, `https://app.preb.co/`** and your Vercel preview pattern `https://*-<your-team-slug>.vercel.app/**`. Save.
- [ ] 4b. (Day 7) change *Site URL* to `https://app.preb.co`.
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
- [ ] 5. (Day 7) switch Test mode off; with the live key in the env run `npm run stripe:catalogue`, `npm run stripe:portal`, `npm run stripe:webhook` (live secret → Vercel env); you run one real Checkout with a real card and refund it.



## M5 · Vercel — project, domain, env · needed day 2 (step 6 on day 7)

- [x] 1. In a terminal: `npm i -g vercel`, then `vercel login` (opens the browser). In the repo folder run `vercel link` and create project `preb-app` in your team. The team needs the **Pro plan** (1‑minute cron jobs).
- [ ] 2. In [https://vercel.com](https://vercel.com) open the project → **Settings → Domains → Add** `app.preb.co`. Note the CNAME target `cname.vercel-dns.com`.
- [ ] 3. At the DNS provider for preb.co (where the Framer site is configured): add a **CNAME** record, host `app`, value `cname.vercel-dns.com`. Framer keeps the apex and `www`. Wait for the green check in Vercel.
- [ ] 4. **Settings → Environment Variables**: add every variable from `.env.example` for *Production* and *Preview*. The secret values only you hold: Supabase secret key, FullEnrich key, Stripe secret + webhook secret, Resend key, Sentry DSN.
- [ ] 5. After the first deploy open **Settings → Cron Jobs** and confirm `/api/jobs/tick` (every minute) and `/api/jobs/daily` are listed and enabled.
- [ ] 6. (Day 7) run `vercel --prod`.



## M6 · Local webhook tunnel · needed day 3

- [x] 1. `brew install cloudflared`.
- [x] 2. In a second terminal: `cloudflared tunnel --url http://localhost:3000`. Copy the printed `https://….trycloudflare.com` URL.
- [x] 3. Set it in `.env.local` as `NEXT_PUBLIC_APP_URL` and restart `npm run dev`. The URL changes every time the tunnel restarts. (`*.trycloudflare.com` is already allowed in `next.config.ts`.)



## M7 · Resend — one check

- [x] 1. Open [https://resend.com/domains](https://resend.com/domains) and confirm `preb.co` shows **Verified** (DKIM and SPF) and that the return‑path / MX record exists. Open and click tracking are already off. Claude created the sending‑only key through the MCP (`RESEND_API_KEY` in `.env.local`); add the same value to Vercel in M5 step 4.



## M7b · Brand assets for emails · done on day 2, repeat after a logo change

- [x] `npx tsx --env-file=.env.local scripts/upload-brand-assets.ts` uploads `public/logoName.png` and `public/logo.png` to the public Storage bucket `brand`; emails load the logo from there. Set `EMAIL_ASSET_BASE_URL` only if the assets move elsewhere (e.g. the Framer site).
- Sign‑up requires a work email. Founders/testers with personal addresses go into `ADMIN_EMAILS` (locally and in Vercel, M5 step 4).



## M8 · Legal (Leon, before launch)

- [ ] Privacy policy states: contact data is enriched from third‑party data providers; enriched data is retained until the customer deletes the list; processors are FullEnrich, Supabase, Stripe, Resend, Vercel, Sentry; US sales; deletion path (delete list in app, workspace deletion on request).
- [ ] Terms state: credits expire 3 months after grant (12 months on annual plans, trial 30 days); consumed credits are non‑refundable; personal email data may be used for recruiting outreach only.
- [ ] Send Claude the final URLs for Terms and Privacy — they go into the login footer, the signup consent checkbox, the Configure‑step notice and the Stripe portal configuration.