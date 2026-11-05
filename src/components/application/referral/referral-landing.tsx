import { RiBankCardLine, RiCoinLine, RiLinkUnlinkM, RiMailCheckLine, RiShieldCheckLine, RiUserSearchLine } from "@remixicon/react";
import { Avatar } from "@/components/base/avatar/avatar";
import { ButtonLink } from "@/components/base/buttons/button";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { REFERRAL_TRIAL_CREDITS, REFERRALS_SETTINGS_PATH, referralGoPath } from "@/lib/referrals/constants";
import type { ReferralLanding as Landing } from "@/lib/referrals/queries";
import { initialsOf } from "@/utils/initials";

const BENEFITS = [
  { icon: RiUserSearchLine, title: "Verified contact data for recruiting", text: "Work emails, personal emails and mobile numbers for candidate lists, checked before you see them." },
  { icon: RiCoinLine, title: `${REFERRAL_TRIAL_CREDITS} free credits to start`, text: "Enough for a first list. Credits are only spent on results we actually find." },
  { icon: RiBankCardLine, title: "No card needed for the trial", text: "Try it with your own list first. Plans start when you are ready." },
] as const;

/** The card a friend sees when opening an invite link: who invited them and what they get. */
export function ReferralLanding({ landing, isOwnLink }: { landing: Landing; isOwnLink: boolean }) {
  const { inviter, workspaceName, code } = landing;
  return (
    <div className="w-full max-w-[560px] rounded-3xl border border-border-button-default bg-background-primary-default p-6 shadow-xs animate-page-enter sm:p-10">
      <div className="flex flex-col items-center gap-6 text-center">
        <Avatar size="lg" src={inviter.avatarUrl ?? undefined} alt="" initials={initialsOf(inviter.fullName)} color="blue" className="size-18" />
        <div className="flex flex-col gap-2">
          <h1 className="text-title-2-medium text-text-primary">{inviter.firstName} invited you to Preb</h1>
          <p className="text-body-regular text-text-secondary">
            {inviter.fullName} from <span className="text-text-primary">{workspaceName}</span> uses Preb to find verified contact data for candidates and thinks it could help you too.
          </p>
        </div>

        <ul className="flex w-full flex-col gap-3 text-start">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3 rounded-2xl bg-background-secondary-default p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background-primary-default">
                <Icon className="size-5 text-foreground-icon-secondary" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-body-medium text-text-primary">{title}</span>
                <span className="text-body-2-regular text-text-secondary">{text}</span>
              </span>
            </li>
          ))}
        </ul>

        {isOwnLink ? (
          <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-border-button-default p-4">
            <p className="text-body-regular text-text-secondary">This is your own invite link. Share it with people outside your workspace to earn credits.</p>
            <ButtonLink href={REFERRALS_SETTINGS_PATH} variant="secondary">
              Open Invite friends
            </ButtonLink>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-3">
            <ButtonLink href={referralGoPath(code)} className="w-full">
              Create your free account
            </ButtonLink>
            <p className="text-center text-body-2-regular text-text-tertiary">
              <RiMailCheckLine className="me-1.5 inline size-4 align-text-bottom" aria-hidden />
              Sign up with your work email. Already have an account?{" "}
              <a href={referralGoPath(code)} className="whitespace-nowrap text-text-primary underline underline-offset-2">
                Sign in
              </a>
            </p>
          </div>
        )}

        <p className="text-center text-caption-1-regular text-text-tertiary">
          <RiShieldCheckLine className="me-1 inline size-3.5 align-text-bottom" aria-hidden />
          {inviter.firstName} only learns that someone signed up, never who, unless you tell them.
        </p>
      </div>
    </div>
  );
}

/** Unknown, revoked or deleted invite link. Says nothing about which. */
export function ReferralUnavailable() {
  return (
    <div className="w-full max-w-[480px] rounded-3xl border border-border-button-default bg-background-primary-default shadow-xs animate-page-enter">
      <EmptyState
        icon={RiLinkUnlinkM}
        title="This invite link is no longer valid"
        description="The person who sent it may have left Preb. You can still create your own account and start with free trial credits."
        actions={<ButtonLink href="/login">Create a free account</ButtonLink>}
      />
    </div>
  );
}
