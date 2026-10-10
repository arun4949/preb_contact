# Legal texts (preparation)

Markdown drafts of the legal pages for preb.co. They are reviewed step by step in chat and later moved into the website. Controller: Kranz & Gupta, Indiepal GbR, Brunnenstr. 11, 53123 Bonn, Germany, represented by Leon Kranz and Arun Gupta.

Copy rules: no em dashes, en dashes or " - " as punctuation (AGENTS.md). The enrichment provider is named only in the Sub-processor List and the DPA, never in the privacy policy, UI or emails.

## Status

| Document | File | Status |
|---|---|---|
| Privacy Policy | `privacy-policy.md` | Draft v1.0, awaiting founder review |
| Terms of Service (B2B only, incl. acceptable use, credits, refunds) | `terms-of-service.md` | Draft v1.0, awaiting founder review |
| Data Processing Agreement (Art. 28 GDPR, SCCs by reference, CCPA service provider terms) | `dpa.md` | Draft v1.0, awaiting founder review |
| Sub-processor List (names the enrichment provider and its sub-processors) | `sub-processors.md` | Draft v1.0, awaiting founder review |
| Cookie Policy | Termly | Covered by Termly (CTO decision 2026-10-09), no markdown file |
| Contact opt-out / suppression page text ("Your data and Preb") | `contact-opt-out.md` | Draft v1.0, awaiting founder review |
| Imprint | handled by Leon | Texts exist |

## Decisions the texts are built on (2026-10-09)

- Preb acts as **processor only** for Contact data. No cross-customer reuse of enrichment results, no own contact database, so no US data broker registration.
- Product news to existing customers on an **opt-out** basis (Art. 6 (1) (f) GDPR, § 7 (3) UWG) with an unsubscribe link in every email.
- Infrastructure in the **USA** (Supabase us-east-1, Vercel US East), controller in Germany. Transfers via DPF where certified, otherwise SCCs.
- English only. No data protection officer.
- Supervisory authority: LDI NRW (Düsseldorf).
- Terms (2026-10-09): German law, Bonn courts, no arbitration; permitted use is recruiting and hiring only; no refunds except by law; credits non-refundable and expiring; cancel at period end; B2B only.
- DPA (2026-10-09): two-tier Sub-processor List. Tier 1 is Preb's direct sub-processors (Supabase, Vercel, FullEnrich); tier 2 is the providers they publish for customer data (FullEnrich: DigitalOcean, Enrow, Icypeas, Datagma, BounceBan, EmailListVerify, ListMint; Supabase and Vercel: AWS, Cloudflare). Reason: EDPB Opinion 22/2024 expects the controller to know the whole chain. 30 days notice of changes, 14 days to object. FullEnrich data stays in the EU, transfers under SCCs with Preb as exporter.
- Business risk noted 2026-10-09: FullEnrich's terms forbid making enriched data available to third parties and ask integrators to sign a specific agreement. Preb's model is that integration. Raise it with FullEnrich when negotiating the partnership.

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
6. Termly: maintain the cookie list, enable GPC handling, confirm autoBlock covers the Featurebase widget and any website analytics. Add a "Cookie preferences" link to the website footer.
7. Link Privacy Policy, Terms and Imprint from every page (website and app) and enter the privacy URL in the Google OAuth consent screen. App side done: the login card and the auth footer link to `https://preb.co/terms` and `https://preb.co/privacy` (2026-10-10, the website and legal pages are built in Framer by Leon on preb.co; the app moves to app.preb.co, see `docs/setup_manual.md` M11). Open: publish the pages in Framer, and the Google console entry.
8. ~~Featurebase data minimisation~~ Done 2026-10-09: the Stripe customer id is no longer sent to Featurebase.
9. ~~Two-factor authentication~~ Confirmed by the CTO 2026-10-09.

## Reference material reviewed

FullEnrich privacy policy, DPA (incl. Appendix 1 security measures), sub-processor list and cookie policy as of October 2026, used for structure only.
