import { Stepper } from "@/components/base/stepper/stepper";

const STEPS = [
  { id: "workspace", label: "Your workspace" },
  { id: "source", label: "One question" },
];

/** Progress of a new owner's onboarding: the workspace card, then the optional question. */
export function OnboardingSteps({ current, className }: { current: 0 | 1; className?: string }) {
  return <Stepper steps={STEPS} current={current} className={className} />;
}
