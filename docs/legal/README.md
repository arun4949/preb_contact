# Legal texts (preparation)

Markdown drafts of the legal pages for preb.co. They are reviewed step by step in chat and later moved into the website. Controller: Kranz & Gupta, Indiepal GbR, Brunnenstr. 11, 53123 Bonn, Germany, represented by Leon Kranz and Arun Gupta.

Copy rules: no em dashes, en dashes or " - " as punctuation (AGENTS.md). The enrichment provider is named only in the Sub-processor List and the DPA, never in the privacy policy, UI or emails.

## Status

| Document | File | Status |
|---|---|---|
| Privacy Policy | `privacy-policy.md` | v1.1 (2026-10-14): § 2 exception, § 4 purpose row, § 8 retention row and § 12 "Sample lists prepared by Preb" for the lead magnet funnel. Re-paste `/privacy` in Framer |
| Terms of Service (B2B only, incl. acceptable use, credits, refunds) | `terms-of-service.md` | v1.1 (2026-10-14): § 5 "Sample lists" clause for the lead magnet funnel. Re-paste `/terms` in Framer |
| Data Processing Agreement (Art. 28 GDPR, SCCs by reference, CCPA service provider terms) | `dpa.md` | Draft v1.0, awaiting founder review |
| Sub-processor List (names the enrichment provider and its sub-processors) | `sub-processors.md` | Draft v1.0, awaiting founder review |
| Cookie Policy | Termly | Covered by Termly (CTO decision 2026-10-09), no markdown file |
| Contact opt-out / suppression page text ("Your data and Preb") | `contact-opt-out.md` | v1.1 (2026-10-13): points to the self-service form at app.preb.co/opt-out |
| Imprint | `imprint.html` | Rebuilt from the old site 2026-10-13 (ODR section dropped, platform closed 20 July 2025) |

Paste-ready HTML for the Framer Embeds (2026-10-13): `privacy-policy.html` (/privacy), `terms-of-service.html` (/terms), `dpa.html` (/dpa), `sub-processors.html` (/sub-processor), `imprint.html` (/imprint), `contact-opt-out.html` (/contact-opt-out, linked from Privacy Policy § 12). Each file is a snippet with fonts (Stack Sans Headline, Geist), styles and content, no page chrome. Tables are written as lists because Framer text cannot hold tables. Edit the markdown and the HTML together.

## Decisions the texts are built on (2026-10-09)

- Preb acts as **processor only** for Contact data. No cross-customer reuse of enrichment results, no own contact database, so no US data broker registration.
- **Exception, lead magnet funnel (2026-10-14):** founders enrich 10 to 20 profiles a prospect names as a free sample (`/admin/leads`, public page `app.preb.co/l/<token>` behind a 4-digit code). For those Contacts Preb is the **controller** on legitimate interest (Art. 6 (1) (f) GDPR): the sample is limited to the named people, shown only to that prospect, never combined with other data, deleted at the latest 12 months after the link was last opened (daily job). The prospect's own details (name, company, LinkedIn, optional email) and engagement events (no IP, no user agent) are B2B prospecting data on the same basis. The code gate shows no consent line (CTO decision, 2026-10-14). Lists run in the internal "Preb outreach" workspace and are measured, never charged.
- Product news to existing customers on an **opt-out** basis (Art. 6 (1) (f) GDPR, § 7 (3) UWG) with an unsubscribe link in every email.
- One onboarding call to new trial customers (2026-10-12): phone number optional at onboarding, **opt-out** notice at signup and a switch in Settings › Profile › Calls that defaults to on. Basis: legitimate interest (Art. 6 (1) (f) GDPR) and presumed consent of a business (§ 7 (2) no. 1 UWG). Calls are dialled by hand by a founder; no autodialer, no prerecorded messages, no SMS (keeps the US TCPA out of scope). Number stored in `profile_phones` (own row only, never visible to teammates), never sent to Resend, Featurebase or Stripe.
- Infrastructure in the **USA** (Supabase us-east-1, Vercel US East), controller in Germany. Transfers via DPF where certified, otherwise SCCs.
- English only. No data protection officer.
- Supervisory authority: LDI NRW (Düsseldorf).
- Terms (2026-10-09): German law, Bonn courts, no arbitration; permitted use is recruiting and hiring only; no refunds except by law; credits non-refundable and expiring; cancel at period end; B2B only.
- DPA (2026-10-09): two-tier Sub-processor List. Tier 1 is Preb's direct sub-processors (Supabase, Vercel, FullEnrich); tier 2 is the providers they publish for customer data (FullEnrich: DigitalOcean, Enrow, Icypeas, Datagma, BounceBan, EmailListVerify, ListMint; Supabase and Vercel: AWS, Cloudflare). Reason: EDPB Opinion 22/2024 expects the controller to know the whole chain. 30 days notice of changes, 14 days to object. FullEnrich data stays in the EU, transfers under SCCs with Preb as exporter.
- Business risk noted 2026-10-09: FullEnrich's terms forbid making enriched data available to third parties and ask integrators to sign a specific agreement. Preb's model is that integration. Raise it with FullEnrich when negotiating the partnership. The lead magnet samples (2026-10-14) hand enriched data to a non-customer prospect for free; flagged to the CTO, same conversation with FullEnrich.

## Open placeholders

- `[date of publication]` at the top of every text: set when the pages are built.
- Confirm the DPF status of Supabase and Termly on dataprivacyframework.gov before publishing. Vercel, Resend, Stripe and Google are certified per their own pages.
- Answered 2026-10-09: no analytics or marketing tools on the website so far (privacy policy says so); no Sentry (removed from all texts); DPA Annex 2 statements on 2FA and restore tests confirmed by the CTO.

## Code and process changes the policy depends on

The policy describes the target state. These items must be done before or at publication so the text is true:

1. ~~Enrichment cache~~ Done 2026-10-09 (migration 0017: per-workspace key, purged with the list, 90-day purge in the daily job).
2. ~~Product news~~ Done 2026-10-09: Settings › Profile switch mirrored to the Resend contact, onboarding note, welcome footer. Product news go out as Resend Broadcasts (built-in unsubscribe link). The Resend webhook `contact.updated` / `contact.deleted` at `/api/webhooks/resend` syncs unsubscribes back; its signing secret is `RESEND_WEBHOOK_SECRET` (set in Vercel too).
3. ~~Deletion~~ Done 2026-10-09: self-service Delete account (Profile) and Delete workspace (Members, owner only). Privacy requests go to hello@preb.co (CTO decision 2026-10-09, no separate privacy mailbox).
4. ~~`email_sends` retention~~ Done 2026-10-09: deleted with the account and purged after 12 months by the daily job.
5. ~~Suppression list~~ Done 2026-10-09 (migration 0018): `/admin/suppressions` for founders; suppressed people are skipped at upload, provider results that match are discarded, stored results are cleared, rows show "Suppressed" and export empty.
6. Termly: maintain the cookie list, enable GPC handling, confirm autoBlock covers the Featurebase widget and any website analytics. Add a "Cookie preferences" link to the website footer. Finding 2026-10-14: autoBlock is not effective in the app. The resource blocker is injected after the app bundle (Termly warns "ResourceBlocker is not the first script"), and a fresh visitor gets the Featurebase cookie `featurebase-anon-id-…` (1 year) before any consent. Loading the blocker first (`beforeInteractive`) was tried and reverted: it loaded Termly three times, caused a hydration error and blocked Cloudflare Turnstile, which breaks the opt-out form. Open decision for the founders: either categorise Turnstile as essential in the Termly dashboard and retry the early load, or mount the Featurebase messenger only after functional consent.
7. Link Privacy Policy, Terms and Imprint from every page (website and app) and enter the privacy URL in the Google OAuth consent screen. App side done: the login card and the auth footer link to `https://preb.co/terms` and `https://preb.co/privacy` (2026-10-10, the website and legal pages are built in Framer by Leon on preb.co; the app moves to app.preb.co, see `docs/setup_manual.md` M11). Open: publish the pages in Framer, and the Google console entry.
8. ~~Featurebase data minimisation~~ Done 2026-10-09: the Stripe customer id is no longer sent to Featurebase.
9. ~~Two-factor authentication~~ Confirmed by the CTO 2026-10-09.
11. ~~Self-service opt-out form~~ Done 2026-10-13 (migration 0021): `app.preb.co/opt-out` (public, Turnstile, email confirmed by a one-time link, phone and LinkedIn reviewed by a founder on `/admin/suppressions`); suppressed provider results are no longer charged to the customer. Privacy policy § 12 and "Your data and Preb" v1.1 updated; re-paste both in Framer (`/privacy`, `/contact-opt-out`).
12. Lead magnet samples (2026-10-14, migrations 0022 and 0023): code done (`/admin/leads`, `/l/<token>`, daily purge after 12 months, opt-out form covers the people in samples). Leon re-pastes `/privacy` (v1.1) and `/terms` (v1.1) in Framer.
10. ~~Phone number and onboarding call~~ Done 2026-10-12 (migration 0019): optional phone with country selector on `/onboarding`, Phone row and Calls › Onboarding call switch in Settings › Profile, "Recent signups" table with phone and consent on `/admin/ops`. Privacy policy § 3.1, § 4, § 8, § 13.1 and § 15 updated.

## Reference material reviewed

FullEnrich privacy policy, DPA (incl. Appendix 1 security measures), sub-processor list and cookie policy as of October 2026, used for structure only.
