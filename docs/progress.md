# Sprint progress log

Update at the end of every session. Newest day on top. Legend: ✅ done · ⚠️ partial · ⬜ not started.

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

### Next: Day 1
Docs are done → start with BoardUI installs + base components, root layout, migration 0001, auth routes, onboarding, FullEnrich client, Stripe test catalogue. Needs M1–M3 for end‑to‑end auth/enrichment testing; code can be written before they are done.
