import { RiBankCardLine, RiDatabase2Line, RiFileListLine, RiLifebuoyLine, RiRocketLine, RiTeamLine, RiUserSearchLine } from "@remixicon/react";
import type { DocsCollectionSlug } from "@/lib/docs/types";

/** Icons stay out of the content registry so it remains plain data. */
export const COLLECTION_ICON: Record<DocsCollectionSlug, typeof RiRocketLine> = {
  "getting-started": RiRocketLine,
  lists: RiFileListLine,
  enrich: RiUserSearchLine,
  data: RiDatabase2Line,
  billing: RiBankCardLine,
  workspace: RiTeamLine,
  troubleshooting: RiLifebuoyLine,
};
