-- Day 5: subscription state mirrored from Stripe + low-credit notification flag.
alter table public.workspaces
  add column if not exists subscription_status text,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists low_credits_notified_at timestamptz;

comment on column public.workspaces.subscription_status is 'Stripe subscription status (active, past_due, canceled, ...) mirrored by the webhook.';
comment on column public.workspaces.low_credits_notified_at is 'When the last low-credit email was sent; reset to null by the next grant.';

create index if not exists workspaces_stripe_customer_id_idx on public.workspaces (stripe_customer_id) where stripe_customer_id is not null;
