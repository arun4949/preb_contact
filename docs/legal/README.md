# Legal texts (preparation)

Markdown drafts of the legal pages for preb.co. They are reviewed step by step in chat and later moved into the website. Controller: Kranz & Gupta, Indiepal GbR, Brunnenstr. 11, 53123 Bonn, Germany, represented by Leon Kranz and Arun Gupta.

Copy rules: no em dashes, en dashes or " - " as punctuation (AGENTS.md). The enrichment provider is named only in the Sub-processor List and the DPA, never in the privacy policy, UI or emails.

## Status

| Document | File | Status |
|---|---|---|
| Privacy Policy | `privacy-policy.md` | Draft v1.0, awaiting founder review |
| Terms of Service (B2B only, incl. acceptable use, credits, refunds) | `terms-of-service.md` | Not started |
| Data Processing Agreement (Art. 28 GDPR, SCCs by reference, CCPA service provider terms) | `dpa.md` | Not started |
| Sub-processor List (names the enrichment provider and its sub-processors) | `sub-processors.md` | Not started |
| Cookie Policy (can be generated from Termly, cookie table) | `cookie-policy.md` | Not started |
| Contact opt-out / suppression page text ("Your data and Preb") | `contact-opt-out.md` | Not started |
| Imprint | handled by Leon | Texts exist |

## Decisions the texts are built on (2026-10-09)

- Preb acts as **processor only** for Contact data. No cross-customer reuse of enrichment results, no own contact database, so no US data broker registration.
- Product news to existing customers on an **opt-out** basis (Art. 6 (1) (f) GDPR, § 7 (3) UWG) with an unsubscribe link in every email.
- Infrastructure in the **USA** (Supabase us-east-1, Vercel US East), controller in Germany. Transfers via DPF where certified, otherwise SCCs.
- English only. No data protection officer.
- Supervisory authority: LDI NRW (Düsseldorf).

## Open placeholders in privacy-policy.md

- `[date of publication]` at the top.
- Section 5: cookie and analytics tools of the marketing website (ask Leon).
- Section 6 and 7: confirm the DPF status of Supabase and Termly on dataprivacyframework.gov before publishing. Vercel, Resend, Stripe, Google and Sentry are certified per their own pages.
- Section 6: keep or drop the Sentry row depending on whether a Sentry DSN is set on Vercel.

## Code and process changes the policy depends on

The policy describes the target state. These items must be done before or at publication so the text is true:

1. ~~Enrichment cache~~ Done 2026-10-09 (migration 0017: per-workspace key, purged with the list, 90-day purge in the daily job).
2. ~~Product news~~ Done 2026-10-09: Settings › Profile switch mirrored to the Resend contact, onboarding note, welcome footer. Product news go out as Resend Broadcasts (built-in unsubscribe link). The Resend webhook `contact.updated` / `contact.deleted` at `/api/webhooks/resend` syncs unsubscribes back; its signing secret is `RESEND_WEBHOOK_SECRET` (set in Vercel too).
3. ~~Deletion~~ Done 2026-10-09: self-service Delete account (Profile) and Delete workspace (Members, owner only). Still to do: create the `privacy@preb.co` mailbox for requests by email.
4. ~~`email_sends` retention~~ Rows are deleted with the account; a 12-month purge job is still open. Sentry error reports: 90 days is Sentry's default.
5. Suppression list for Contacts who object (table plus check in the dispatcher and in display/export).
6. Termly: maintain the cookie list, enable GPC handling, confirm autoBlock covers the Featurebase widget and any website analytics. Add a "Cookie preferences" link to the website footer.
7. Link Privacy Policy, Terms and Imprint from every page (website and app) and enter the privacy URL in the Google OAuth consent screen.
8. Optional data minimisation: remove `stripeCustomerId` from the Featurebase identity token (`src/lib/featurebase/jwt.ts`); if kept, Section 3.5 already discloses it.
9. Two-factor authentication on Supabase, Vercel, Stripe, Resend, Featurebase and Google accounts for both founders (Section 9 states this).

## Reference material reviewed

FullEnrich privacy policy, DPA (incl. Appendix 1 security measures), sub-processor list and cookie policy as of October 2026, used for structure only.
