import Image from "next/image";
import { Avatar } from "@/components/base/avatar/avatar";
import type { LeadOwnerView } from "@/lib/leads/owners";
import { initialsOf } from "@/utils/initials";
import { cx } from "@/utils/cx";

/** Round portrait of the founder who prepared the list; initials when there is no image. */
export function OwnerPortrait({ owner, size, className }: { owner: LeadOwnerView; size: number; className?: string }) {
  if (!owner.imageUrl) return <Avatar size="lg" initials={initialsOf(owner.fullName)} color="blue" alt="" className={className} />;
  return (
    <Image
      src={owner.imageUrl}
      alt=""
      width={size}
      height={size}
      className={cx("shrink-0 rounded-full object-cover", className)}
      style={{ width: size, height: size }}
      priority
    />
  );
}
