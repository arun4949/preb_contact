import { Stepper } from "@/components/base/stepper/stepper";

const STEPS = [
  { id: "workspace", label: "Your workspace" },
  { id: "source", label: "How you found us" },
  { id: "ats", label: "Your ATS" },
];

/** Progress of a new owner's onboarding: the workspace card, then the two optional questions. */
export function OnboardingSteps({ current, className }: { current: 0 | 1 | 2; className?: string }) {
  return <Stepper steps={STEPS} current={current} labels="current" className={className} />;
}
