import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // BoardUI-installed sources that sync state inside effects by design
    // (open/close transitions). The settings pages are forked on day 6 and
    // the date picker / plan art are removed with them.
    files: [
      "src/components/base/date-picker/**",
      "src/components/application/settings/settings-modal.tsx",
      "src/components/application/settings/plan-art-flame.tsx",
    ],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
]);

export default eslintConfig;
