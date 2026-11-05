# Invite friends (referral programme)

This note is for us; the user-facing guide lives in the help center at `/docs/billing/referral-program`, the rules in Terms § 5, § 6.3 and § 6.4, the data in Privacy § 3.1, § 4, § 5, § 8 and § 15.

## How it fits together

1. **Code.** `fetchReferralOverview` creates one `referral_codes` row per workspace on first open (8 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, CSPRNG, unique). There is no rotation; `revoked_at` is the admin kill switch (set by hand in SQL for now). Internal workspaces (`kind = 'internal'`) never get a code.
2. **Share.** The user copies `app.preb.co/r/<code>` or opens a prefilled `mailto:` in their own mail client. Preb never sends an email to the invitee: the BGH (I ZR 208/12, 2013) holds the operator liable for tell-a-friend mails sent from its servers (§ 7 UWG).
3. **Landing.** `/r/<code>` shows the inviter (first name, avatar, workspace) and the trial. Unknown, revoked, internal and throttled requests all render the same generic card, so the page is not an oracle for live codes. `/r/<code>/go` sets the httpOnly `preb_ref` cookie (30 days), counts the click once per browser and redirects to `/login`.
4. **Attribution** (`lib/referrals/attribution.ts`), written server-side only and idempotent through the unique `referred_user_id` and `referred_email_hash`:
   - `sendMagicLink`: a first-time address makes `generateLink` create the account; the cookie is on that device, so the attribution happens there and the confirm click can come from any device.
   - `auth/callback` (Google): accounts under an hour old.
   - `completeOnboarding` (owners): belt and braces, then the cookie is cleared.
   The pure rules in `eligibility.ts` reject, in this order: revoked code, internal referrer, account older than 60 minutes, invitee without own workspace, member of the referrer's workspace, the referrer's own address, same company domain (free-mail domains compare the full address only), recreated account (`deleted_accounts` tombstone, 12 months). Rejected rows stay in the table with the reason for `/admin/referrals` and are never shown to the referrer.
5. **Reward.** `onInvoicePaid` calls `rewardReferral` for every subscription invoice with `amount_paid > 0` that is not an overspend invoice, before the plan-grant decision. The RPC `reward_referral` locks the pending row `for update`, re-checks expiry, internal/self and the 30-day cap, then `grant_credits(referrer, amount, 'referral', now + 12 months, null, 'Referral reward')`. The grant carries no invoice id because `credit_grants.stripe_invoice_id` is unique and the referee's plan grant owns it. Outcomes: `none`, `already_rewarded`, `expired`, `ineligible`, `cap_reached`, `rewarded`. On `rewarded` the app clears `low_credits_notified_at`, writes one `referral_rewarded` notification (dedupe key per referral) and emails the owner. A database error propagates so the webhook returns 500 and Stripe retries; every step is idempotent.
6. **Expiry.** The daily job marks pending rows past `expires_at` as `expired`. The credits themselves expire through `expire_grants` like every other grant.
7. **Withdrawal.** `revoke_referral_reward` zeroes the grant's `remaining`, writes an `adjust` ledger row and sets `revoked`. Only unused credits are taken back; credits already spent were bought from the provider.

## Configuration

| Env var | Default | Meaning |
|---|---|---|
| `REFERRAL_REWARD_CREDITS` | 500 | Credits per rewarded referral |
| `REFERRAL_WINDOW_DAYS` | 90 | Days after the referee's signup in which the first paid invoice counts |
| `REFERRAL_MAX_REWARDS_PER_MONTH` | 10 | Rewarded referrals per referrer workspace in a rolling 30 days |

Invalid or missing values fall back to the defaults (`lib/referrals/config.ts`). The amount shown in the UI and the amount granted both read the env var at request time.

## Data

- `referral_codes`: `workspace_id` (unique), `code` (unique), `created_by`, `click_count`, `revoked_at`.
- `referrals`: `code_id`, `referrer_workspace_id`, `referred_user_id` (unique, set null on delete), `referred_workspace_id`, `referred_email_hash` (unique, sha256 of the lower-cased address, same `emailHash` as account deletion), `referred_email_masked`, `source` (`magic_link` / `oauth` / `onboarding`), `status` (`pending` / `rewarded` / `expired` / `rejected` / `revoked`), `rejected_reason`, `signed_up_at`, `expires_at`, `reward_credits`, `stripe_invoice_id`, `grant_id` (unique), `rewarded_at`, `revoked_at`, `revoked_by`.
- Both tables: RLS on, no policies (service role only). Two foreign keys each to `workspaces` and `profiles`: embeds must name the key (`workspaces!referrals_referrer_workspace_id_fkey`).

## Testing

- Unit: `lib/referrals/code.test.ts`, `eligibility.test.ts`, `reward.test.ts`; copy and proxy cases.
- Browser walk recipe (scratchpad Playwright, see `docs/progress.md` 2026-11-05): referrer on a fake work domain onboarded in the database (no mail to it), referee and the self-referral user on `delivered+<label>@resend.dev` sinks, the referrer's `profiles.email` switched to a sink before the reward so the reward mail lands in the sink. The purchase is a signed `invoice.paid` (`stripe.webhooks.generateTestHeaderString`) posted to `/api/webhooks/stripe` with the real test price `preb_p2_1k_m` and `parent.subscription_details.metadata.workspace_id` of the referee workspace. Delete workspaces first (owner restrict), then users.

## Not done on purpose

- No automatic clawback on refunds or disputes (CTO decision): admins withdraw on `/admin/referrals`.
- No referee bonus, no code rotation, no server-sent invitation emails.
- The landing throttle is per server instance (same best-effort helper as the opt-out form).
