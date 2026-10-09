# Preb.co — Recruiting Data Enrichment · Product MVP

> Audience: the Claude Code agent and the founding team. This document explains **what** we are building and **why**, in product language. The technical plan is in `implementation_plan.md`, screen layouts in `screens.md`, the provider API in `fullenrich.md`, manual setup in `setup_manual.md`.

## 1. One‑paragraph pitch

Preb is a contact‑data enrichment tool for US recruiters. A recruiter uploads a spreadsheet of candidates or hiring managers (names + companies, or LinkedIn URLs, or emails). Preb finds verified work emails, personal emails and mobile numbers, shows the results in a clean list, and lets the recruiter download the enriched spreadsheet. Under the hood the MVP uses the FullEnrich API 1:1; the user never sees that. The experience must feel like an expensive, polished product (Wiza‑level), not a prototype.

## 2. Strategy context (why this shape)

1. **MVP (this sprint):** CSV upload → enrichment via FullEnrich → download. Same data quality as FullEnrich, our own UI, our own credits and billing, with a margin on top of FullEnrich pricing.
2. **Next:** once paying customers exist, negotiate a FullEnrich partnership for better buy prices and add features (integrations, white label).
3. **Later:** build our own waterfall enrichment and leave FullEnrich.

Consequence for the MVP: everything that touches the provider must sit behind one small layer so that step 3 is a swap, not a rewrite. Everything the user sees must be *ours* (naming, credits, emails, statuses).

## 3. Who uses it

- **Recruiters / sourcers** at US agencies and in‑house teams. Comfortable with spreadsheets and LinkedIn. Not technical. They care about: find rate, email validity (bounces hurt), speed, and a clean export that opens in Excel/Google Sheets.
- **Team leads / owners** who pay. They invite colleagues into a workspace and want one bill and one credit pool.

## 4. Core concepts and vocabulary

| Term | Meaning |
|---|---|
| **Workspace** | A team account. Owns lists, members, credits and the Stripe subscription. Every user gets one at signup unless they were invited into an existing one. |
| **Member** | A user in a workspace. Roles: owner, admin, member. Admins/owners manage members, billing and can delete lists. |
| **List** | One uploaded spreadsheet and its enrichment run. Has a name, a status, counters and an export. |
| **Contact** | One row in a list. Input fields (name, company, domain, LinkedIn URL, email) plus found fields. |
| **Enrichment fields** | What the user asks us to find: **Work email** (2 credits), **Personal email** (6 credits), **Mobile phone** (20 credits). Landline numbers are returned free. Nothing found = nothing charged. |
| **Credit** | Our unit of value. 1 Preb credit = ½ FullEnrich credit (pricing v2, 2026-10-08) — our tiers carry 2× the credits at 1.25× the price, so the per-credit price looks lower while the margin stays ≥ 20 %. Credits belong to the workspace, come from a subscription plan (or the trial) and expire 3 months after they are granted (12 months on annual plans). |
| **Email status** | **Valid** (deliverable or high probability), **Risky** (catch‑all domain, may bounce), **Not found**. Risky emails are still charged by the provider, so we show them clearly. |
| **Reverse lookup** | If a row only has an email, we can identify the person (name, title, company, LinkedIn) for 2 credits. Scheduled for the last sprint day; cut first if time is short. |

## 5. The user journey

1. **Sign in** with Google or a magic link. No passwords.
2. **Onboarding** (first time only): full name, workspace name. Invited users skip this and land in the inviter's workspace.
3. **Lists dashboard**: cards for each list with a gauge of contacts, valid/risky email percentages, phones found, duplicates removed, and a Download button. Empty state offers a sample CSV.
4. **New list** (three steps):
   1. *Upload* a CSV or XLSX (drag & drop). Up to 10,000 rows.
   2. *Map fields*: we guess which column is first name, last name, company, domain, LinkedIn URL, email; the user corrects if needed and sees example values. We tell them how many rows are enrichable and how many duplicates we removed.
   3. *Configure*: pick Work email / Personal email / Mobile phone, name the list, see a credit estimate ("typically ~320, up to 415") against their balance. If short, a "Buy credits" button. Then **Start enrichment**.
5. **Enriching**: the list opens immediately with a premium progress panel (steps, live count, ETA). Rows fill in as results arrive. The user can close the tab; we email when done. A **Stop** button stops new work (contacts already in progress finish).
6. **Enriched list**: a table with name, title, company (logo), location, work email with status, personal email, phone with type, LinkedIn link. Filter rail (Valid / Risky / Not found, phone found), search, column settings, pagination. **Download** all or a segment. The export keeps the original columns and appends ours.
7. **Credits & billing**: a credits menu in the header shows the balance and expiry. Settings → Billing shows the plan, lets the user pick a plan (monthly or annual, Stripe Checkout) and manage payment/invoices in the Stripe customer portal. We never render card forms.
8. **Team**: Settings → Workspace lists members, lets admins invite by email (we send the invite), change roles, remove members.

## 6. Credits, plans and money rules

- Plans mirror FullEnrich's Pro tiers at 2× the credits: 1,000 → 200,000 credits/month ($36.50 → $4,375) and 12,000 → 2.4M credits/year ($390 → $47,250), USD. Price = FullEnrich price × 1.25 rounded up to $0.50. All tiers self-serve; above that "Contact us".
- Monthly credits expire 3 months after grant; annual credits are granted up front and expire after 12 months. Credits are consumed oldest‑expiring first.
- New workspaces get **50 trial credits** (expire in 30 days). One trial per person.
- Before a run starts, the workspace needs at least the *typical* estimate available. We put a hold on that amount; actual consumption is settled per batch from the provider's real cost. If a run exhausts the balance, it **pauses** with a buy button and **resumes automatically** after purchase.
- A contact enriched in the same workspace within the last 90 days is free again (we serve it from our store). A contact enriched by another workspace is served from our store too and charged normally.
- Everything we enrich is stored permanently with timestamps (for our future own engine) until the user deletes the list.

## 7. Experience principles (non‑negotiable)

1. **Premium, calm, fast.** Wiza's layout, BoardUI's components and tokens. No raw colors, no improvised typography, no spinners — skeletons and purposeful motion.
2. **Every state is designed**: empty, loading, in progress, paused, stopped, error, zero results, mobile.
3. **Never expose the provider.** No "FullEnrich" in UI, emails, exports or error messages. Upstream problems read as "Paused — resuming shortly".
4. **Honest numbers.** Show typical and maximum credit cost before starting; show exactly what was used after.
5. **Responsive**: works on a 13" laptop and a phone (cards stack, table scrolls with a sticky name column, filters become a sheet).
6. **Accessible**: keyboard through everything, focus rings, reduced‑motion respected.

## 8. Out of scope for the MVP

CRM integrations, Chrome extension, prospecting/search, folders, company enrichment, public API, per‑user credit limits, SSO/SAML, retry of not‑found contacts. (The notification center, once a stretch goal, shipped on 2026-10-09: header bell with workspace events plus admin announcements.)

## 9. Success criteria for the sprint

- A new user can sign in, upload a real recruiter spreadsheet, enrich 50–500 contacts, watch progress, and download a correct export, without help.
- Credits shown always reconcile with what the provider charged us.
- A paying workspace can buy a plan and invite a teammate.
- Lighthouse ≥ 90 for performance and accessibility; looks right in light and dark mode; no provider names leak.

## 10. Team and tooling

- CTO (Arun) builds the app with Claude Code; co‑founder Leon builds the marketing site in Framer and owns legal pages.
- Stack: Next.js 16 (App Router) on Vercel, Supabase (Postgres, Auth, Storage, Realtime), BoardUI (React + Tailwind v4), Stripe, Resend, FullEnrich API v2.
- Claude Code has MCP access to Supabase, Stripe, Resend, Figma and BoardUI. Everything else that needs a human is in `setup_manual.md`.
