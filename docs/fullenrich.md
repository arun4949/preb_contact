# FullEnrich API v2 — implementation notes

Verified against https://docs.fullenrich.com (Oct 2026). Use **v2** only. Base URL `https://app.fullenrich.com/api/v2`. Never show the provider name in UI, emails or exports.

## Auth & limits
- Header `Authorization: Bearer <FULLENRICH_API_KEY>`. 401 codes: `error.authorization.not_set`, `error.authorization.not_bearer`, `error.api.key`.
- **Rate limit: 60 calls/minute, fixed calendar‑minute window, across all endpoints (GETs included).** 429 → `error.rate.limit` "Too many requests. Try again in 1m". Our dispatcher budgets ≤40 submits + ≤10 GETs per minute via the `provider_rate_limit` row.
- Queue: 100 concurrent enrichments per workspace; excess queues upstream, never expires.
- `GET /account/keys/verify` → `{ workspace_id }`. `GET /account/credits` → `{ balance }` (our balance; alert < 20 %).

## Start bulk enrichment
`POST /contact/enrich/bulk?silentFail=true` (silentFail skips invalid rows instead of failing the batch).
```json
{
  "name": "list_<listId>_batch_<n>",
  "webhook_url": "https://app.preb.co/api/webhooks/fullenrich",
  "webhook_events": { "contact_finished": "https://app.preb.co/api/webhooks/fullenrich" },
  "data": [{
    "first_name": "John", "last_name": "Snow",
    "domain": "example.com", "company_name": "Example Inc",
    "linkedin_url": "https://www.linkedin.com/in/demoge/",
    "enrich_fields": ["contact.work_emails", "contact.personal_emails", "contact.phones"],
    "custom": { "contact_id": "<uuid>", "list_id": "<uuid>", "batch_id": "<uuid>" }
  }]
}
```
- Max **100 contacts** per call. `custom`: string values only, ≤10 keys, ≤100 chars each; echoed back unchanged.
- Minimum input per contact: `first_name` + `last_name` + (`domain` or `company_name`) **or** `linkedin_url` (standard or Sales Navigator URL).
- Response `200 { "enrichment_id": "uuid" }`. 400 codes: `error.enrichment.name.empty`, `.webhook_url`, `.data.empty`, `.first_name.empty`, `.last_name.empty`, `.domain.empty`, `.enrich_fields.empty`, `.enrich_field.value`, `.custom.key.exceeded`, `.custom.value.exceeded`.

## Get result
`GET /contact/enrich/bulk/{enrichment_id}` (`?forceResults=true` for partial data).
- **400 `error.enrichment.in_progress`** while running (not a 200 with IN_PROGRESS).
- 200 when finished; 402 Payment Required with the same body when upstream credits ran out (`status: CREDITS_INSUFFICIENT`); 404 `error.enrichment.not_found` (also after 3‑month retention).
- Body: `{ id, name, status, cost: { credits }, data: Record[] }`; `status ∈ CREATED | IN_PROGRESS | CANCELED | CREDITS_INSUFFICIENT | FINISHED | RATE_LIMIT | UNKNOWN`.

### Record
```
input:        { first_name, last_name, full_name, company_domain, company_name, professional_network_url }
custom:       { ...echo }
contact_info: {
  most_probable_work_email:     { email, status } | null
  most_probable_personal_email: { email, status } | null
  most_probable_phone:          Phone | null
  work_emails[], personal_emails[]: { email, status }[]
  phones[]: Phone[]          // may include landline / VoIP / inactive, not billable
}
profile:      Person | undefined   // guaranteed when linkedin_url given
```
- `Email.status`: `DELIVERABLE | HIGH_PROBABILITY | CATCH_ALL | INVALID | INVALID_DOMAIN`.
- `Phone`: `number` ("+1 555-123-4567"), `region` (ISO‑2), `line_type MOBILE|LANDLINE|VOIP|UNKNOWN`, `line_status ACTIVE|INACTIVE|UNKNOWN`, `ownership_match CONFIRMED|MISMATCH` (US/CA), `ownership_match_confidence 0–100`, `connect_rate HIGHEST|HIGH|MEDIUM`.
- `Person`: `id, full_name, first_name, last_name, headline, description?, location{country,country_code,city,region}, social_profiles.professional_network{id,url,handle,connection_count}, educations[]{school_name,degree,start_at,end_at}, languages[], skills[], employment{ current: Employment, all: Employment[] }`.
- `Employment`: `title, seniority, job_functions[], description, is_current, start_at, end_at?, company{ id, name, domain, website, description, year_founded, headcount, headcount_range, company_type, specialties[], technologies[], locations{headquarters{line1,line2,city,region,country,country_code}, offices[]}, industry.main_industry, social_profiles, logo_url }`.
- **Only `most_probable_*` are billable and are what we display as primary values.** Arrays are candidates.

### Our mapping (`src/lib/fullenrich/mapping.ts`)
| Preb field | Source |
|---|---|
| work_email / work_email_status | `most_probable_work_email` |
| personal_email / status | `most_probable_personal_email` |
| phone / phone_meta | `most_probable_phone` (+ `phones[]` kept in `result`) |
| job_title | `profile.employment.current.title` |
| company / company_domain / logo | `profile.employment.current.company.{name,domain,logo_url}` fallback input |
| location | `profile.location` → "City, Region, Country" |
| linkedin_url | `profile.social_profiles.professional_network.url` fallback input |
| UI email status | Valid = DELIVERABLE, HIGH_PROBABILITY · Risky = CATCH_ALL · Not found = null/INVALID/INVALID_DOMAIN |
| UI phone chip | Mobile if `line_type = MOBILE`, else Landline (free) |
| per‑contact credits | 1 if work email present (status ≠ INVALID*) + 3 if personal email + 10 if `most_probable_phone.line_type = MOBILE`; reconciled to batch `cost.credits`, delta → ledger `adjust` |

## Webhooks
- `webhook_url`: POST when the whole batch is FINISHED, CREDITS_INSUFFICIENT or CANCELED; body = GET response.
- `webhook_events.contact_finished`: POST per contact as it completes; body has **one** item in `data[]` and `status: "IN_PROGRESS"`.
- Signature: header `X-Signature-SHA1` = lowercase hex HMAC‑SHA1 of the **raw body** with our API key as secret.
  ```ts
  const expected = createHmac("sha1", apiKey).update(rawBody, "utf8").digest("hex");
  ok = expected.length === sig.length && timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  ```
  Read with `await req.text()` **before** JSON parsing. Return 401 on mismatch, 200 fast otherwise.
- Retries: non‑2xx → retried every minute up to 5 times → handler must be idempotent: key `webhook_events.external_id = "<enrichment_id>:<contact_id|batch>:<kind>"`.
- Polling guidance: webhooks first; if polling, ≥ every 5–10 min per batch. We reconcile batches with no webhook after 15 min, ≤1 GET / 10 min / batch.

## Reverse email lookup (day 7 / stretch)
- `POST /contact/reverse/email/bulk?silentFail=true` `{ name, webhook_url, webhook_events?, data:[{ email, custom }] }` → `{ enrichment_id }`; 100 per call. 400: `error.reverse.email.invalid`, `error.reverse.email.empty`.
- `GET /contact/reverse/email/bulk/{id}` → same envelope, records `{ input:{email}, custom, profile: Person }`. 1 credit per identified person. 404 `error.reverse.email.not_found`.

## Credits (what we are charged)
| Result | Credits |
|---|---|
| Work email DELIVERABLE / HIGH_PROBABILITY / **CATCH_ALL** | 1 |
| Work email INVALID / none | 0 |
| Personal email (valid) | 3 |
| Mobile phone (`most_probable_phone` MOBILE) | 10 |
| Landline / VoIP / inactive / none | 0 |
| Reverse email lookup identified | 1 |
| Same input re‑enriched within 3 months | 0 (upstream dedup) |
| Person/company profile with enrichment | 0 |
- Results retained upstream 3 months; we store permanently in `list_contacts.result` + `enrichment_cache`.
- Upstream pricing (for our plans): Pro monthly 500→$29, 750→$42.75, 1k→$55, 1.5k→$79.50, 2k→$104, 5k→$255, 10k→$499, 15k→$720, 25k→$1,150, 50k→$1,950, 100k→$3,500. Annual (credits/yr → $/mo): 6k→$26, 9k→$39, 12k→$49, 18k→$71, 24k→$94, 60k→$232, 120k→$454, 180k→$655, 300k→$1,046, 600k→$1,769, 1.2M→$3,150. Rollover 3 months monthly / 12 months annual; no overage.

## Timing
40 s – 2 min per contact; 100 in parallel per workspace → a 100‑row batch ≈ 1–2 min, 1,000 rows ≈ 10–20 min. Show ETA from the average of finished batches.

## Testing
- Zero‑credit test contact (exact values): `first_name "Grégoire"`, `last_name "Démogé"`, `domain "fullenrich.com"`, `company_name "FullEnrich"`, `linkedin_url "https://www.linkedin.com/in/demoge/"`.
- Webhook signature + payload fixtures in `src/lib/fullenrich/__fixtures__/` (from docs examples). MSW handlers mock all endpoints for engine tests, including 400 in_progress, 402, 429.
