# Manual setup tasks (step by step)

These are the only tasks Claude Code cannot do through MCP. Tick them off as you go. Menu names are current as of Oct 2026; if a label differs, the setting lives in the same section. Never paste secrets into chat — put them in `.env.local` (gitignored) and say "done".

## M1 · Google Cloud Console — reuse the old Preb OAuth client · needed day 1
- [ ] 1. Open https://console.cloud.google.com and select the project that holds the old Preb OAuth client. Go to **APIs & Services → Credentials**.
- [ ] 2. Click the existing **OAuth 2.0 Client ID** (type "Web application").
- [ ] 3. Under **Authorized redirect URIs** click **Add URI** and paste `https://zigocelujwbasujrozpk.supabase.co/auth/v1/callback`. Keep the old URIs.
- [ ] 4. Under **Authorized JavaScript origins** add `https://app.preb.co` and `http://localhost:3000`. Click **Save**.
- [ ] 5. Copy **Client ID** and **Client secret** (needed in M2 step 3).
- [ ] 6. Open **OAuth consent screen**: app name "Preb", upload the new logo, publishing status must be **In production** (otherwise only test users can sign in).

## M2 · Supabase dashboard — providers, SMTP, URLs · needed day 1 (step 4b on day 7)
- [ ] 1. Open https://supabase.com/dashboard → project **preb-contact** (ref `zigocelujwbasujrozpk`).
- [ ] 2. **Authentication → Sign In / Providers → Email**: keep *Enable Email provider* on. *Confirm email* may stay on (the magic link confirms). Set *Email OTP expiration* to 3600 s. Save.
- [ ] 3. **Authentication → Sign In / Providers → Google**: toggle **Enable**, paste Client ID and Client secret from M1. Save.
- [ ] 4. **Authentication → URL Configuration**: *Site URL* `http://localhost:3000` for now. Under *Redirect URLs* add `http://localhost:3000/**`, `https://app.preb.co/**` and your Vercel preview pattern `https://*-<your-team-slug>.vercel.app/**`. Save.
- [ ] 4b. (Day 7) change *Site URL* to `https://app.preb.co`.
- [ ] 5. **Project Settings → Authentication → SMTP Settings** (older layout: *Authentication → Emails → SMTP*): toggle **Enable Custom SMTP**. Sender email `login@preb.co`, sender name `Preb`, host `smtp.resend.com`, port `465`, username `resend`, password = the Resend API key Claude creates for you (ask for "the SMTP key"). Set *Rate limit for sending emails* to 100 per hour. Save.
- [ ] 6. **Authentication → Emails → Templates**: paste the *Magic Link* and *Invite user* HTML that Claude provides (file `docs/email-templates/`). Save each.
- [ ] 7. **Project Settings → API Keys**: reveal the **secret (service_role) key**, paste it into `.env.local` as `SUPABASE_SECRET_KEY`. Never commit it. Tell Claude "done".

## M3 · FullEnrich — account & API key · needed day 1
- [ ] 1. Sign up at https://app.fullenrich.com with a company email (50 free credits). Before day 3, buy the smallest Pro plan (500 credits, $29) so real enrichments and webhooks can be tested.
- [ ] 2. **Settings → API** (https://app.fullenrich.com/app/api) → **Create API key**, name `preb-prod`. Paste into `.env.local` as `FULLENRICH_API_KEY`. Optional: set a consumption limit on the key as a spend guard.
- [ ] 3. **Settings → Workspace**: enable **Personal email enrichment**. **Settings → Credits → Alerts**: alert at 20 %.
- [ ] 4. (Day 7) create a second key `preb-dev` for local testing.

## M4 · Stripe dashboard — items the API cannot toggle · needed day 5 (step 5 on day 7)
- [ ] 1. Log in to https://dashboard.stripe.com (account **Preb.co**). Switch **Test mode** on (toggle top right) while we build. Claude creates products, prices, portal configuration and webhooks via MCP in test mode first.
- [ ] 2. **Settings → Tax**: enable **Stripe Tax**. Add US registrations if you have any; otherwise leave collection off (calculation still shows correct totals). Set the default product tax code to *Software as a service (B2B)* `txcd_10103001`.
- [ ] 3. **Settings → Billing → Customer portal**: verify *Business information* (name Preb, support email, Terms and Privacy URLs from Leon's site) and *Branding* (new logo, accent colour).
- [ ] 4. **Settings → Business → Branding / Public details**: upload the new Preb logo, set statement descriptor `PREB.CO`.
- [ ] 5. (Day 7) switch Test mode off; Claude creates the live catalogue and webhook; you run one real Checkout with a real card and refund it.

## M5 · Vercel — project, domain, env · needed day 2 (step 6 on day 7)
- [ ] 1. In a terminal: `npm i -g vercel`, then `vercel login` (opens the browser). In the repo folder run `vercel link` and create project `preb-app` in your team. The team needs the **Pro plan** (1‑minute cron jobs).
- [ ] 2. In https://vercel.com open the project → **Settings → Domains → Add** `app.preb.co`. Note the CNAME target `cname.vercel-dns.com`.
- [ ] 3. At the DNS provider for preb.co (where the Framer site is configured): add a **CNAME** record, host `app`, value `cname.vercel-dns.com`. Framer keeps the apex and `www`. Wait for the green check in Vercel.
- [ ] 4. **Settings → Environment Variables**: add every variable from `.env.example` for *Production* and *Preview*. The secret values only you hold: Supabase secret key, FullEnrich key, Stripe secret + webhook secret, Resend key, Sentry DSN.
- [ ] 5. After the first deploy open **Settings → Cron Jobs** and confirm `/api/jobs/tick` (every minute) and `/api/jobs/daily` are listed and enabled.
- [ ] 6. (Day 7) run `vercel --prod`.

## M6 · Local webhook tunnel · needed day 3
- [ ] 1. `brew install cloudflared`.
- [ ] 2. In a second terminal: `cloudflared tunnel --url http://localhost:3000`. Copy the printed `https://….trycloudflare.com` URL.
- [ ] 3. Set it in `.env.local` as `NEXT_PUBLIC_APP_URL` and restart `npm run dev`. The URL changes every time the tunnel restarts.

## M7 · Resend — one check
- [ ] 1. Open https://resend.com/domains and confirm `preb.co` shows **Verified** (DKIM and SPF) and that the return‑path / MX record exists. Turn open and click tracking **off** for transactional mail. Claude creates API keys and templates through the MCP.

## M8 · Legal (Leon, before launch)
- [ ] Privacy policy states: contact data is enriched from third‑party data providers; enriched data is retained until the customer deletes the list; processors are FullEnrich, Supabase, Stripe, Resend, Vercel, Sentry; US sales; deletion path (delete list in app, workspace deletion on request).
- [ ] Terms state: credits expire 3 months after grant (12 months on annual plans, trial 30 days); consumed credits are non‑refundable; personal email data may be used for recruiting outreach only.
- [ ] Send Claude the final URLs for Terms and Privacy — they go into the login footer, the signup consent checkbox, the Configure‑step notice and the Stripe portal configuration.
