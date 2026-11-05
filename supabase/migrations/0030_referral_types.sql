-- 0030: enum values for the referral programme (own migration: a new enum
-- value cannot be used in the transaction that adds it, see 0026).
--   grant_source 'referral'           credits earned by inviting a friend
--   email_kind   'referral_rewarded'  the "you earned credits" mail
alter type public.grant_source add value if not exists 'referral';
alter type public.email_kind add value if not exists 'referral_rewarded';
