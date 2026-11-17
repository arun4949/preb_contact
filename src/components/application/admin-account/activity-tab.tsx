import Link from "next/link";
import { Chip } from "@/components/base/badges/chip";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import type { AccountDetail } from "@/lib/admin/accounts";
import { META_ATTRIBUTION_META } from "@/lib/admin/attribution";
import { day, n, plural, when } from "@/lib/admin/format";
import { cx } from "@/utils/cx";
import { Block, Card, Field, Fields, Muted, Nothing, PartError, humanize } from "./parts";

const linkClass = "rounded-sm underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring";

const SIGNUP_SOURCE: Record<string, string> = { magic_link: "Email sign-in", oauth: "Google", onboarding: "Onboarding" };

/** Names that read better than the stored kind; the rest is shown as stored, with spaces. */
const EMAIL_KIND: Record<string, string> = { magic_link: "Sign-in email", invite: "Workspace invite", credits_low: "Low credits", ops_alert: "Ops alert", opt_out_verify: "Opt-out verification", opt_out_done: "Opt-out confirmation" };

const REFERRAL_CHIP: Record<string, { label: string; color: "yellow" | "lime" | "neutral" | "rose" | "orange" }> = {
  pending: { label: "Pending", color: "yellow" },
  rewarded: { label: "Rewarded", color: "lime" },
  expired: { label: "Expired", color: "neutral" },
  rejected: { label: "Rejected", color: "orange" },
  revoked: { label: "Revoked", color: "rose" },
};

/** Where the account came from and what it did besides enriching: ads, referrals, AI assistants, emails, colleagues. */
export function ActivityTab({ detail }: { detail: AccountDetail }) {
  const { meta, referredBy, leadShare, referralCode, mcp, emails, sameDomain } = detail;

  return (
    <>
      <Card title="Where this account came from">
        <Fields>
          <Field label="Meta ads">
            {meta.error !== null ? (
              <span className="text-text-error-primary">Could not be loaded: {meta.error}</span>
            ) : (
              <span className="flex flex-col gap-1">
                <span>
                  <Chip variant="caption" color={META_ATTRIBUTION_META[meta.data.attribution].color}>
                    {META_ATTRIBUTION_META[meta.data.attribution].label}
                  </Chip>
                </span>
                <span className="text-body-2-regular text-text-secondary">
                  {META_ATTRIBUTION_META[meta.data.attribution].description}
                  {meta.data.capturedAt ? ` Captured ${when(meta.data.capturedAt)}${meta.data.source ? ` at ${SIGNUP_SOURCE[meta.data.source]?.toLowerCase() ?? meta.data.source}` : ""}.` : ""}
                </span>
              </span>
            )}
          </Field>
          <Field label="Referral">
            {referredBy.error !== null ? (
              <span className="text-text-error-primary">Could not be loaded: {referredBy.error}</span>
            ) : referredBy.data ? (
              <span className="flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  Invited by {referredBy.data.workspaceName}
                  <Chip variant="caption" color={REFERRAL_CHIP[referredBy.data.status]?.color ?? "neutral"}>
                    {REFERRAL_CHIP[referredBy.data.status]?.label ?? humanize(referredBy.data.status)}
                  </Chip>
                </span>
                <span className="text-body-2-regular text-text-secondary">
                  Signed up {day(referredBy.data.signedUpAt)} through {SIGNUP_SOURCE[referredBy.data.source]?.toLowerCase() ?? referredBy.data.source}
                  {referredBy.data.rejectedReason ? `. Rejected: ${humanize(referredBy.data.rejectedReason).toLowerCase()}` : ""}.
                </span>
              </span>
            ) : (
              <Muted>Not referred</Muted>
            )}
          </Field>
          <Field label="Lead magnet">
            {leadShare.error !== null ? (
              <span className="text-text-error-primary">Could not be loaded: {leadShare.error}</span>
            ) : leadShare.data ? (
              <span>
                Signed up from a shared lead list{leadShare.data.signedUpAt ? ` on ${day(leadShare.data.signedUpAt)}` : ""}.{" "}
                <Link href={`/admin/leads?list=${leadShare.data.listId}`} className={cx(linkClass, "underline")}>
                  Open in Leads
                </Link>
              </span>
            ) : (
              <Muted>Not from a lead list</Muted>
            )}
          </Field>
          <Field label="Own invite link">
            {referralCode.error !== null ? (
              <span className="text-text-error-primary">Could not be loaded: {referralCode.error}</span>
            ) : referralCode.data ? (
              <span className="flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-caption-1-regular" dir="ltr">
                    {referralCode.data.code}
                  </span>
                  {referralCode.data.revoked ? (
                    <Chip variant="caption" color="rose">
                      Revoked
                    </Chip>
                  ) : null}
                </span>
                <span className="text-body-2-regular text-text-secondary">
                  {plural(referralCode.data.clicks, "click", "clicks")}, {plural(referralCode.data.signups, "signup", "signups")}, {n(referralCode.data.rewarded)} rewarded, {plural(referralCode.data.rewardCredits, "credit", "credits")} earned.
                </span>
              </span>
            ) : (
              <Muted>No invite link created</Muted>
            )}
          </Field>
        </Fields>
      </Card>

      {sameDomain.error !== null ? (
        <Block title="Other accounts at the same company">
          <PartError title="Accounts on the same domain could not be loaded" error={sameDomain.error} />
        </Block>
      ) : sameDomain.data ? (
        <Block
          title={`Other accounts at ${sameDomain.data.domain}`}
          description="Accounts with the same email domain. Several separate workspaces for one company usually mean each person took their own trial."
        >
          {sameDomain.data.accounts.length === 0 ? (
            <Nothing text="No other account uses this email domain." />
          ) : (
            <Table aria-label="Accounts on the same email domain" size="sm" containerClassName="rounded-2xl">
              <TableHeader>
                <TableColumn isRowHeader>Name</TableColumn>
                <TableColumn>Email</TableColumn>
                <TableColumn>Status</TableColumn>
                <TableColumn>Created</TableColumn>
              </TableHeader>
              <TableBody>
                {sameDomain.data.accounts.map((account) => (
                  <TableRow key={account.userId}>
                    <TableCell className="whitespace-nowrap">
                      <Link href={`/admin/users/${account.userId}`} className={linkClass}>
                        {account.fullName ?? <Muted>Not onboarded</Muted>}
                      </Link>
                    </TableCell>
                    <TableCell dir="ltr">{account.email}</TableCell>
                    <TableCell>
                      <Chip variant="caption" color={account.onboarded ? "lime" : "neutral"}>
                        {account.onboarded ? "Onboarded" : "Not onboarded"}
                      </Chip>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{when(account.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Block>
      ) : null}

      <Block title="AI assistants" description="Assistants this person connected through the Preb MCP server.">
        {mcp.error !== null ? (
          <PartError title="AI assistant connections could not be loaded" error={mcp.error} />
        ) : mcp.data.length === 0 ? (
          <Nothing text="No AI assistant connected." />
        ) : (
          <Table aria-label="AI assistant connections" size="sm" containerClassName="rounded-2xl">
            <TableHeader>
              <TableColumn isRowHeader>Assistant</TableColumn>
              <TableColumn className="text-end">Tool calls</TableColumn>
              <TableColumn>Last used</TableColumn>
              <TableColumn>Connected</TableColumn>
            </TableHeader>
            <TableBody>
              {mcp.data.map((connection, index) => (
                <TableRow key={`${connection.clientName}-${index}`}>
                  <TableCell>{connection.clientName}</TableCell>
                  <TableCell className="text-end tabular-nums">{n(connection.toolCalls)}</TableCell>
                  <TableCell className="whitespace-nowrap">{connection.lastUsedAt ? when(connection.lastUsedAt) : <Muted>Never</Muted>}</TableCell>
                  <TableCell className="whitespace-nowrap">{day(connection.connectedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Block>

      <Block title="Emails we sent" description="The latest 30 emails to this address. Older records are removed by the daily cleanup.">
        {emails.error !== null ? (
          <PartError title="Sent emails could not be loaded" error={emails.error} />
        ) : emails.data.length === 0 ? (
          <Nothing text="No email on record for this address." />
        ) : (
          <Table aria-label="Emails sent" size="sm" containerClassName="rounded-2xl">
            <TableHeader>
              <TableColumn isRowHeader>Email</TableColumn>
              <TableColumn>Sent</TableColumn>
            </TableHeader>
            <TableBody>
              {emails.data.map((email) => (
                <TableRow key={email.id}>
                  <TableCell>{EMAIL_KIND[email.kind] ?? humanize(email.kind)}</TableCell>
                  <TableCell className="whitespace-nowrap">{when(email.sentAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Block>
    </>
  );
}
