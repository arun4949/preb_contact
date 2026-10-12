import Image from "next/image";
import { cx } from "@/utils/cx";

/**
 * Preb brand mark. `public/logo.svg` is the square icon (single accent fill,
 * theme-independent). `public/logoName.svg` / `logoName_light.svg` are the
 * icon + wordmark lockup (3067×1300) with a dark / white wordmark; the root
 * theme class decides which one participates in layout (see `.theme-logo-*`
 * in globals).
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return <Image src="/logo.svg" alt="Preb" width={size} height={size} className={cx("shrink-0", className)} priority />;
}

const LOCKUP_RATIO = 3067 / 1300;
/**
 * Visual size of the lockup per `height` prop. Tailwind's preflight sets
 * `img { height: auto }`, so the rendered size follows the width; the header
 * look (24 → 79×33 px, 28 → 92×39 px) was tuned against this width, so it
 * stays the reference. The height attribute matches the artwork ratio, so
 * nothing is letterboxed.
 */
const WIDTH_PER_HEIGHT = 2145 / 650;

/** Icon + wordmark lockup. `height` is the size token used across the app (24 headers, 28 auth pages). */
export function LogoName({ height = 24, className }: { height?: number; className?: string }) {
  const width = Math.round(height * WIDTH_PER_HEIGHT);
  const renderedHeight = Math.round(width / LOCKUP_RATIO);
  return (
    <>
      <Image src="/logoName.svg" alt="Preb" width={width} height={renderedHeight} className={cx("theme-logo-light shrink-0", className)} priority />
      <Image src="/logoName_light.svg" alt="Preb" width={width} height={renderedHeight} className={cx("theme-logo-dark shrink-0", className)} priority />
    </>
  );
}
