import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Kbd } from "@/components/base/kbd/kbd";
import { parseInline } from "@/lib/docs/inline";
import { UiLabel } from "./docs-primitives";

const LINK = "rounded-sm text-accent-600 underline-offset-3 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring active:text-accent-800";

/** Turns a docs string with inline markup into React nodes. */
export function renderInline(text: string): ReactNode {
  return parseInline(text).map((node, i) => {
    switch (node.kind) {
      case "text":
        return <Fragment key={i}>{node.text}</Fragment>;
      case "label":
        return <UiLabel key={i}>{node.text}</UiLabel>;
      case "kbd":
        return <Kbd key={i}>{node.text}</Kbd>;
      case "link":
        return node.href.startsWith("/") ? (
          <Link key={i} href={node.href} className={LINK}>
            {node.text}
          </Link>
        ) : (
          <a key={i} href={node.href} target="_blank" rel="noopener noreferrer" className={LINK}>
            {node.text}
          </a>
        );
    }
  });
}
