import type { DocsBlock } from "@/lib/docs/types";
import { createIdAllocator } from "@/lib/docs/slug";
import { renderInline } from "./docs-inline";
import { DocsCallout, DocsH2, DocsH3, DocsList, DocsP, DocsSteps, DocsTable } from "./docs-primitives";

/** Renders an article body. Heading ids use the same allocator as `tocOf`, so the table of contents always matches. */
export function DocsArticle({ blocks }: { blocks: DocsBlock[] }) {
  const id = createIdAllocator();
  return (
    <div className="flex flex-col gap-5">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            return (
              <DocsH2 key={i} id={id(b.text)}>
                {renderInline(b.text)}
              </DocsH2>
            );
          case "subheading":
            return <DocsH3 key={i}>{renderInline(b.text)}</DocsH3>;
          case "paragraph":
            return <DocsP key={i}>{renderInline(b.text)}</DocsP>;
          case "steps":
            return <DocsSteps key={i} items={b.items.map(renderInline)} />;
          case "list":
            return <DocsList key={i} items={b.items.map(renderInline)} />;
          case "callout":
            return (
              <DocsCallout key={i} tone={b.tone} title={b.title ? renderInline(b.title) : undefined}>
                {renderInline(b.text)}
              </DocsCallout>
            );
          case "table":
            return <DocsTable key={i} columns={b.columns.map(renderInline)} rows={b.rows.map((r) => r.map(renderInline))} />;
        }
      })}
    </div>
  );
}
