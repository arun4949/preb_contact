import { RiArrowRightUpLine } from "@remixicon/react";
import { Chip } from "@/components/base/badges/chip";
import { Banner } from "@/components/base/banner/banner";
import { ButtonLink } from "@/components/base/buttons/button";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import type { AccountDetail } from "@/lib/admin/accounts";
import { day, n, when } from "@/lib/admin/format";
import { formatUsdExact } from "@/lib/credits/money";
import { getPlan } from "@/lib/credits/plans";
import { INVOICE_LIMIT } from "@/lib/stripe/invoices";
import { Block, Card, Field, Fields, Muted, Nothing, PartError, humanize } from "./parts";

type ChipColor = "lime" | "yellow" | "rose" | "neutral" | "blue";

const SUBSCRIPTION_CHIP: Record<string, { label: string; color: ChipColor }> = {
  active: { label: "Active", color: "lime" },
  trialing: { label: "Trial", color: "lime" },
  past_due: { label: "Past due", color: "yellow" },
  unpaid: { label: "Unpaid", color: "rose" },
  incomplete: { label: "Incomplete", color: "yellow" },
  incomplete_expired: { label: "Expired", color: "rose" },
  paused: { label: "Paused", color: "neutral" },
  canceled: { label: "Canceled", color: "neutral" },
};

const INVOICE_CHIP: Record<string, { label: string; color: ChipColor }> = {
  paid: { label: "Paid", color: "lime" },
  open: { label: "Open", color: "yellow" },
  draft: { label: "Draft", color: "neutral" },
  void: { label: "Void", color: "neutral" },
  uncollectible: { label: "Uncollectible", color: "rose" },
};

const OVERAGE_CHIP: Record<string, { label: string; color: ChipColor }> = {
  pending: { label: "Pending", color: "neutral" },
  invoicing: { label: "Invoicing", color: "blue" },
  paid: { label: "Paid", color: "lime" },
  failed: { label: "Payment failed", color: "rose" },
  action_required: { label: "Action required", color: "yellow" },
};

const INELIGIBLE: Record<string, string> = {
  internal: "Not available, internal workspace",
  trial: "Not available on the trial",
  no_subscription: "Not available without a running subscription",
  no_payment_method: "Not available without a payment method",
};

/** Plan and subscription, overspend, and what the customer has paid (invoices live from Stripe). */
export function BillingTab({ detail }: { detail: AccountDetail }) {
  const { workspace, overspend, overages, invoices, stripeUrl } = detail;
  if (!workspace) return <Nothing text="This account has no workspace, so there is nothing to bill." />;

  const plan = getPlan(workspace.plan_key);
  const subscription = workspace.subscription_status ? (SUBSCRIPTION_CHIP[workspace.subscription_status] ?? { label: humanize(workspace.subscription_status), color: "neutral" as const }) : null;

  return (
    <>
      <Card
        title="Plan and subscription"
        action={
          stripeUrl ? (
            <ButtonLink href={stripeUrl} target="_blank" rel="noopener noreferrer" variant="secondary" size="small" trailingIcon={RiArrowRightUpLine}>
              Open in Stripe
            </ButtonLink>
          ) : null
        }
      >
        <Fields>
          <Field label="Plan">
            {plan ? (
              <>
                {plan.name} <span className="text-text-tertiary">· {n(plan.credits)} credits per {plan.interval}</span>
              </>
            ) : workspace.plan_key ? (
              workspace.plan_key
            ) : workspace.trial_granted_at ? (
              "Trial"
            ) : (
              "No plan, no trial"
            )}
          </Field>
          <Field label="Subscription">
            {subscription ? (
              <Chip variant="caption" color={subscription.color}>
                {subscription.label}
              </Chip>
            ) : (
              <Muted>None</Muted>
            )}
          </Field>
          <Field label={workspace.cancel_at_period_end ? "Cancels on" : "Renews on"}>{workspace.current_period_end ? day(workspace.current_period_end) : <Muted>—</Muted>}</Field>
          <Field label="Trial granted">{workspace.trial_granted_at ? day(workspace.trial_granted_at) : <Muted>No trial</Muted>}</Field>
          <Field label="Stripe customer">
            {workspace.stripe_customer_id ? (
              <span className="font-mono text-caption-1-regular" dir="ltr">
                {workspace.stripe_customer_id}
              </span>
            ) : (
              <Muted>Never opened a checkout</Muted>
            )}
          </Field>
          <Field label="Stripe subscription">
            {workspace.stripe_subscription_id ? (
              <span className="font-mono text-caption-1-regular" dir="ltr">
                {workspace.stripe_subscription_id}
              </span>
            ) : (
              <Muted>None</Muted>
            )}
          </Field>
        </Fields>
      </Card>

      <Card title="Overspend" description="Opt-in: credits beyond the balance are invoiced at the plan's price per credit.">
        {overspend.error !== null ? (
          <PartError title="Overspend state could not be loaded" error={overspend.error} />
        ) : !overspend.data ? (
          <Muted>No overspend data.</Muted>
        ) : (
          <Fields>
            <Field label="State">
              {overspend.data.active ? (
                <Chip variant="caption" color="lime">
                  On
                </Chip>
              ) : overspend.data.blockedReason ? (
                <Chip variant="caption" color="rose">
                  Blocked, payment failed
                </Chip>
              ) : overspend.data.enabled ? (
                <Chip variant="caption" color="yellow">
                  Opted in, not active
                </Chip>
              ) : (
                <Chip variant="caption" color="neutral">
                  Off
                </Chip>
              )}
            </Field>
            <Field label="Eligibility">{overspend.data.ineligibleReason ? INELIGIBLE[overspend.data.ineligibleReason] : "Eligible"}</Field>
            <Field label="Monthly limit">{overspend.data.limit === null ? <Muted>No limit</Muted> : <span className="tabular-nums">{n(overspend.data.limit)} credits</span>}</Field>
            <Field label="Used this month">
              <span className="tabular-nums">{n(overspend.data.used)} credits</span>
            </Field>
            <Field label="Opted in on">{workspace.overspend_enabled_at ? day(workspace.overspend_enabled_at) : <Muted>Never</Muted>}</Field>
          </Fields>
        )}
      </Card>

      <Block title="Overspend charges" description="One row per batch that went beyond the balance, newest first.">
        {overages.error !== null ? (
          <PartError title="Overspend charges could not be loaded" error={overages.error} />
        ) : overages.data.length === 0 ? (
          <Nothing text="No overspend so far." />
        ) : (
          <Table aria-label="Overspend charges" size="sm" containerClassName="rounded-2xl">
            <TableHeader>
              <TableColumn isRowHeader>When</TableColumn>
              <TableColumn className="text-end">Credits</TableColumn>
              <TableColumn className="text-end">Amount</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Invoice</TableColumn>
              <TableColumn>Error</TableColumn>
            </TableHeader>
            <TableBody>
              {overages.data.map((o) => {
                const chip = OVERAGE_CHIP[o.status] ?? { label: humanize(o.status), color: "neutral" as const };
                return (
                  <TableRow key={o.id}>
                    <TableCell className="whitespace-nowrap">{when(o.createdAt)}</TableCell>
                    <TableCell className="text-end tabular-nums">{n(o.credits)}</TableCell>
                    <TableCell className="text-end tabular-nums">{o.amountCents === null ? <Muted>—</Muted> : formatUsdExact(o.amountCents)}</TableCell>
                    <TableCell>
                      <Chip variant="caption" color={chip.color}>
                        {chip.label}
                      </Chip>
                    </TableCell>
                    <TableCell className="font-mono text-caption-1-regular" dir="ltr">
                      {o.stripeInvoiceId ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      {o.error ? (
                        <span className="block truncate text-text-error-primary" title={o.error}>
                          {o.error}
                        </span>
                      ) : (
                        <Muted>—</Muted>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Block>

      <Block title="Invoices" description="Read live from Stripe when this page loads. Nothing is stored or changed.">
        {invoices.state === "none" ? (
          <Nothing text="This workspace never opened a checkout, so there are no invoices." />
        ) : invoices.state === "other_mode" ? (
          <Banner tone="info" title="This customer belongs to the other Stripe mode">
            Development and production share one database. The customer was created with the other Stripe key, so its invoices are only visible from that environment.
          </Banner>
        ) : invoices.state === "error" ? (
          <PartError title="Invoices could not be loaded from Stripe" error={invoices.message} />
        ) : invoices.invoices.length === 0 ? (
          <Nothing text="Stripe has no invoices for this customer." />
        ) : (
          <>
            <Table aria-label="Invoices" size="sm" containerClassName="rounded-2xl">
              <TableHeader>
                <TableColumn isRowHeader>Invoice</TableColumn>
                <TableColumn>Date</TableColumn>
                <TableColumn>For</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn className="text-end">Paid</TableColumn>
                <TableColumn className="text-end">Due</TableColumn>
              </TableHeader>
              <TableBody>
                {invoices.invoices.map((invoice) => {
                  const chip = INVOICE_CHIP[invoice.status] ?? { label: humanize(invoice.status), color: "neutral" as const };
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="whitespace-nowrap" dir="ltr">
                        {invoice.hostedUrl ? (
                          <a href={invoice.hostedUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                            {invoice.number ?? invoice.id}
                          </a>
                        ) : (
                          (invoice.number ?? invoice.id)
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{day(invoice.createdAt)}</TableCell>
                      <TableCell className="max-w-[320px] truncate">{invoice.description ?? <Muted>—</Muted>}</TableCell>
                      <TableCell>
                        <Chip variant="caption" color={chip.color}>
                          {chip.label}
                        </Chip>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{formatUsdExact(invoice.amountPaidCents)}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatUsdExact(invoice.amountDueCents)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {invoices.hasMore ? (
              <p className="text-body-2-regular text-text-secondary">Showing the newest {INVOICE_LIMIT} invoices. Older ones are in Stripe, and the total paid above counts these {INVOICE_LIMIT} only.</p>
            ) : null}
          </>
        )}
      </Block>
    </>
  );
}
