import Image from "next/image";
import { cx } from "@/utils/cx";

/**
 * Preb brand marks, monochrome since the 2026-11 rebrand. Every mark has a
 * dark artwork for light surfaces (`logo.svg`, `logoName.svg`, #1B1B1B) and a
 * white one for dark surfaces (`logo_light.svg`, `logoName_light.svg`). Both
 * images render and the root theme class decides which one participates in
 * layout (see `.theme-logo-*` in globals), so there is no flash on hydration.
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  // The wrapper takes `className` so utilities like `sm:hidden` are not
  // overridden by the `.dark .theme-logo-dark { display: block }` rule.
  return (
    <span className={cx("inline-flex shrink-0", className)}>
      <Image src="/logo.svg" alt="Preb" width={size} height={size} className="theme-logo-light shrink-0" priority />
      <Image src="/logo_light.svg" alt="" aria-hidden width={size} height={size} className="theme-logo-dark shrink-0" priority />
    </span>
  );
}

/** Lockup artwork is 2398×750 with no padding, so `height` is the rendered height. */
const LOCKUP_RATIO = 2398 / 750;

/** Icon + wordmark lockup. `height` is the size token used across the app (24 headers, 28 auth pages). */
export function LogoName({ height = 24, className }: { height?: number; className?: string }) {
  const width = Math.round(height * LOCKUP_RATIO);
  return (
    <>
      <Image src="/logoName.svg" alt="Preb" width={width} height={height} className={cx("theme-logo-light shrink-0", className)} priority />
      <Image src="/logoName_light.svg" alt="" width={width} height={height} className={cx("theme-logo-dark shrink-0", className)} priority />
    </>
  );
}
