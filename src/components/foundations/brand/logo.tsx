import Image from "next/image";
import { cx } from "@/utils/cx";

/**
 * Preb brand mark. `public/logo.svg` is the square icon (single accent fill,
 * theme-independent). `public/logoName.svg` / `logoName-dark.svg` are the
 * icon + wordmark lockup (2145×650) in black / white; the root theme class
 * decides which one participates in layout (see `.theme-logo-*` in globals).
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return <Image src="/logo.svg" alt="Preb" width={size} height={size} className={cx("shrink-0", className)} priority />;
}

/** Icon + wordmark lockup, sized by height. */
export function LogoName({ height = 24, className }: { height?: number; className?: string }) {
  const width = Math.round((height * 2145) / 650);
  return (
    <>
      <Image src="/logoName.svg" alt="Preb" width={width} height={height} className={cx("theme-logo-light shrink-0", className)} priority />
      <Image src="/logoName-dark.svg" alt="Preb" width={width} height={height} className={cx("theme-logo-dark shrink-0", className)} priority />
    </>
  );
}
