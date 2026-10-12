import { RiCompass3Line } from "@remixicon/react";
import { ButtonLink } from "@/components/base/buttons/button";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { DocsSearch } from "@/components/application/docs/docs-search";
import { docsPath } from "@/lib/site-links";

export default function DocsNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
      <div className="rounded-3xl border border-border-button-default bg-background-primary-default">
        <EmptyState icon={RiCompass3Line} title="Article not found" description="The link may be outdated, or the article was moved." actions={<ButtonLink href={docsPath()}>Help center home</ButtonLink>} />
      </div>
      <DocsSearch size="medium" />
    </div>
  );
}
