-- 0026: enum values for the overspend feature (own migration: a new enum
-- value cannot be used in the transaction that adds it).
--   ledger_kind 'overage'      credits spent beyond the balance, invoiced in money
--   email_kind  overspend_*    receipts and payment-failure mails
alter type public.ledger_kind add value if not exists 'overage';
alter type public.email_kind add value if not exists 'overspend_charged';
alter type public.email_kind add value if not exists 'overspend_failed';
