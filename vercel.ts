import type { VercelConfig } from "@vercel/config/v1";

/**
 * Vercel project config (replaces vercel.json). Cron requests carry
 * `Authorization: Bearer $CRON_SECRET`, which the job routes verify.
 * A 1-minute cron needs the Pro plan (plan flag F4).
 */
export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    { path: "/api/jobs/tick", schedule: "* * * * *" },
    { path: "/api/jobs/daily", schedule: "0 3 * * *" },
  ],
};
