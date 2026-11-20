# Preb automatic emails: executive summary

Status: 2026-11-20, live on app.preb.co. Source of truth is the code in `src/lib/email/`.

## At a glance

- **14 automatic emails**, grouped into 6 categories below. All transactional except the Welcome email, which also opts the person into product news.
- **One pipeline:** every email is rendered in the app (react-email templates in `src/lib/email/templates/`) and sent through **Resend**. Supabase never sends mail, sign-in included.
- **Sender:** "Arun from Preb" <notifications@preb.co>. **Replies** go to hello@preb.co. Every customer email is signed by Arun (portrait, "Co-Founder, Preb"), except internal ops alerts.
- **Every send is logged** in the `email_sends` table (address, kind, workspace, Resend message id). That log also powers the rate limits.
- **No drip or nurture sequence exists yet.** There are no scheduled or time-based emails to customers. Everything fires on an event (sign-in request, onboarding done, list done, balance low, payment).
- **No marketing broadcast has been sent yet** (0 broadcasts in Resend). The product-news list is built and ready.

### Volume since launch (from `email_sends`)

| Email | Total | Last 30 days | First sent |
|---|---:|---:|---|
| Sign-in code and link | 50 | 40 | 2026-10-07 |
| List is ready / stopped | 41 | 26 | 2026-10-07 |
| Welcome | 31 | 25 | 2026-10-08 |
| Ops alert (internal) | 12 | 0 | 2026-10-09 |
| Credits running low | 3 | 1 | 2026-10-07 |
| Overspend payment failed | 3 | 3 | 2026-10-21 |
| Workspace invite | 3 | 0 | 2026-10-07 |
| List paused | 3 | 2 | 2026-10-07 |
| Referral reward | 2 | 2 | 2026-11-05 |
| Overspend charged | 2 | 2 | 2026-10-21 |
| Opt-out verify / done | 0 | 0 | — |

---

## 1. Onboarding flow (most important)

This is the full journey a new user sees by email today. It is **two emails**.

```
Enter work email on /login ──► [1] Sign-in code + link ──► Onboarding form
                                                            (name, workspace, optional phone,
                                                             optional "How did you hear about us?")
                                                                     │
                                                                     ▼
                                                         [2] Welcome email (+ added to product news)
                                                                     │
                                                         Upload first list ──► [3] "Your list is ready"
```

Google sign-in skips email [1] entirely, so a Google user's first email is the Welcome email.

### [1] Sign-in code and link (`magic_link`)

| | |
|---|---|
| Trigger | Someone enters their email on the sign-in page. Same email for first sign-up and every later sign-in. |
| Subject | Your sign-in code for Preb |
| Preview | `123 456` is your Preb sign-in code |
| Content | 6-digit code to type in, plus a "Sign in" button. Code and link are the same token, work once, valid 1 hour. |
| Why a code | People who click our Meta/LinkedIn ads sign up inside the in-app browser. A link would open Safari and lose the session; the code keeps them in the same browser. |
| Guards | Work emails only (personal domains are rejected before sending). Max 5 per address per hour. |

### [2] Welcome (`welcome`)

| | |
|---|---|
| Trigger | The person finishes the onboarding form for the first time. Sent once per person, never again. |
| Subject | Welcome to Preb, {first name} |
| Preview | Your Preb workspace is ready |
| Content | Personal note from Arun ("Thank you for signing up, it really means a lot to us"), workspace name, the 50 free trial credits, how pricing works (credits per work email, personal email, mobile), CTA **"Enrich your first list"** to `/lists/new`. Footer invites replies and mentions product news with an "Email preferences" link. |
| Side effect | Adds the person to the Resend contact list for product news (opt-out model, never overrides an earlier unsubscribe). |

### [3] Your list is ready (`list_finished`)

Technically a product notification (see category 3), but for a new user it is the third and last email of the onboarding journey: it closes the loop on the first list.

### Onboarding: facts worth discussing

1. **No follow-up after Welcome.** Nobody who signs up but never uploads a list hears from us again by email. No day 2 / day 7 nudge, no "your trial credits expire in X days" reminder (trial = 50 credits, valid 30 days), no "trial used up, here are the plans" email.
2. **Trial users never get "credits running low".** That email only fires for paying plans. A trial user only hears about credits when a list actually pauses for lack of credits.
3. **Invited team members also get the Welcome email.** It names the team's workspace, and the "you have X free credits" line shows the shared workspace balance, not a personal trial. Worth checking whether that copy fits invitees.
4. **Google sign-ups get no email before Welcome**, so their first touch is Welcome.
5. **Welcome volume (31) vs sign-in volume (50)** includes repeat sign-ins, so it is not a conversion rate. Real signup funnel numbers live on `/admin/insights` and `/admin/users`.

---

## 2. Auth and team access

| Email | Trigger | Subject | Notes |
|---|---|---|---|
| Sign-in code and link | See onboarding [1] | Your sign-in code for Preb | Same email for login and signup. |
| Workspace invite (`invite`) | An owner or admin invites a teammate in Settings, or resends an invite | You're invited to join {workspace} on Preb | Written as Arun introducing Preb, names the inviter and role. "Accept invite" link valid 7 days, only for that address. A resend invalidates the old link. Max 10 per address per hour plus a per-workspace hourly cap. |

---

## 3. Product notifications (enrichment lists)

Sent to the person who created the list. Each also appears as an in-app notification.

| Email | Trigger | Subject | Content |
|---|---|---|---|
| List ready (`list_finished`) | A list finishes | {list} is ready | Contacts processed, valid emails, catch-all emails, mobiles found, credits used. CTA "View list". Invites a reply if something looks off. |
| List stopped (`list_finished`) | User stops a running list | {list} was stopped | Same stats so far. |
| List paused (`list_paused`) | Running list cannot continue. Three reasons: | | Everything found so far is saved; the list resumes automatically within a minute once fixed. |
| | a) out of credits | {list} is paused, add credits to continue | CTA "Buy credits" |
| | b) monthly overspend limit reached | {list} is paused, your monthly overspend limit is reached | CTA "Raise limit" |
| | c) overspend payment failed | {list} is paused, an overspend payment failed | CTA "Fix payment" |

**In-app only, no customer email:** list paused because our data provider (FullEnrich) is out of credits, and list failed after repeated provider rejections. In both cases the team gets an ops alert instead.

---

## 4. Billing and credits

Sent to the workspace owner.

| Email | Trigger | Subject | Content |
|---|---|---|---|
| Credits running low (`credits_low`) | Balance drops under 10 % of the plan's monthly credits. Once per billing cycle (reset by the next credit grant). Paid plans only. | {workspace} is running low on credits | Balance vs plan credits, explains lists pause at zero. CTA "Upgrade plan". |
| Overspend charged (`overspend_charged`) | An overspend invoice was charged successfully (opt-in feature, credits used beyond the balance) | ${amount} charged for credits beyond your balance | Credits, amount, per-credit rate, breakdown per list. CTA "View invoice" (Stripe hosted invoice). |
| Overspend payment failed (`overspend_failed`) | Overspend charge declined, or the bank needs 3-D Secure confirmation | Your overspend payment did not go through / Please confirm your overspend payment | Lists needing extra credits stay paused until paid. CTA "Fix payment" or "Confirm payment". |

Regular subscription receipts and invoices are not sent by our app (Stripe handles its own customer emails, if enabled in the Stripe dashboard).

---

## 5. Growth (referrals)

| Email | Trigger | Subject | Content |
|---|---|---|---|
| Referral reward (`referral_rewarded`) | A friend who signed up through the owner's invite link pays their first invoice within 90 days | You earned 500 credits on Preb | Masked friend address, credits added, expiry date. CTA "Invite more friends". |

The referred friend gets no special email; they go through the normal onboarding flow (50 trial credits).

---

## 6. Privacy and compliance (GDPR opt-out)

For people whose contact data might be in Preb (candidates, not customers), from the public `/opt-out` page.

| Email | Trigger | Subject | Content |
|---|---|---|---|
| Verify request (`opt_out_verify`) | Someone submits the opt-out form | Confirm your request to Preb | Button to prove the address is theirs. Link works once, valid 24 hours. Max 3 per address per hour. |
| Request confirmed (`opt_out_done`) | They confirmed | Your request to Preb is confirmed | Address is on the suppression list, stored results deleted. If they added a phone or LinkedIn, those are reviewed by the team within 5 business days. |

The team also gets an ops alert for every confirmed opt-out.

---

## 7. Internal ops alerts (team only)

Unsigned emails to the ops address (`OPS_ALERT_EMAIL`, falling back to the first admin email). Subject prefix `[Preb ops]`.

| Alert | When |
|---|---|
| Upstream credit balance is low | Daily check of the FullEnrich account balance |
| Upstream credits exhausted, lists paused | FullEnrich refused work for lack of credits; lists retry every 15 minutes |
| List failed after repeated provider rejections | A list could not be processed |
| Overspend invoice unpaid for more than a week | Overspend is blocked for that workspace until paid |
| Opt-out request confirmed / needs review | Every confirmed opt-out; "needs review" when a phone or LinkedIn must be checked by hand |

---

## Product news list (not yet used)

- Every new user is added to a Resend contact list at Welcome (opt-out basis, as decided with legal).
- Users can switch "Product news" off in Settings › Profile, or unsubscribe from any broadcast; a Resend webhook keeps both in sync.
- Account deletion removes the contact from Resend.
- Sending happens as Resend Broadcasts from the Resend dashboard. **None sent so far.**

---

## Open questions for the co-founder discussion

1. **Activation nudge:** email people who onboarded but have not uploaded a list after 1 to 2 days?
2. **Trial lifecycle:** reminder before the 30-day trial credits expire, and an "out of trial credits, pick a plan" email (today only the list-paused email covers this, and only if a list is running)?
3. **First result follow-up:** after the first finished list, a personal "how did it go?" email from Arun to collect feedback?
4. **Invitee Welcome copy:** keep one Welcome for owners and invitees, or a separate version for invited members?
5. **First product news broadcast:** what, when, and who writes it?
