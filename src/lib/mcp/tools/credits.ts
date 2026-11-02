import "server-only";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { getPlan } from "@/lib/credits/plans";
import { workspaceOverspendState } from "@/lib/billing/overspend";
import { appOrigin } from "@/lib/jobs/shared";
import { withContext } from "../server-context";
import { result } from "../format";

export function registerCreditsTool(server: McpServer) {
  server.registerTool(
    "check_credits",
    {
      title: "Check Preb credits",
      description:
        "How many Preb credits the connected workspace has left, which plan it is on and whether overspend is on. Costs: a found work email is 2 credits, a personal email 6, a mobile phone 20, identifying a person from an email 2. Only results are charged; a person enriched in the last 90 days is free again.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withContext(async (ctx) => {
      const [{ data: available }, overspend] = await Promise.all([
        ctx.admin.rpc("credits_available", { ws: ctx.workspace.id }),
        workspaceOverspendState(ctx.admin, ctx.workspace.id),
      ]);
      const credits = available ?? 0;
      const plan = getPlan(ctx.workspace.plan_key);
      const planName = plan?.name ?? (ctx.workspace.trial_granted_at ? "Free trial" : "No plan");
      const renews = ctx.workspace.current_period_end ? new Date(ctx.workspace.current_period_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
      const overspendText = overspend?.active
        ? overspend.limit != null
          ? `Overspend is on with a monthly limit of ${overspend.limit.toLocaleString("en-US")} credits (${overspend.used.toLocaleString("en-US")} used this month), so runs continue past the balance.`
          : "Overspend is on without a limit, so runs continue past the balance and the shortfall is invoiced."
        : "Overspend is off: a run pauses when the credits run out.";
      const text = [
        `**${credits.toLocaleString("en-US")} credits** available in workspace "${ctx.workspace.name}" (${planName}${renews ? `, renews ${renews}` : ""}).`,
        overspendText,
        `Example: finding work emails for 10 people costs at most 20 credits, typically about 16. Buy credits or change the plan at ${appOrigin()}/lists?settings=billing.`,
      ].join("\n\n");
      return result(text, {
        workspace: ctx.workspace.name,
        credits_available: credits,
        plan: planName,
        renews_at: ctx.workspace.current_period_end,
        overspend: overspend ? { enabled: overspend.active, monthly_limit: overspend.limit, used_this_month: overspend.used } : null,
        cost_per_result: { work_email: 2, personal_email: 6, mobile_phone: 20, reverse_email_lookup: 2 },
        billing_url: `${appOrigin()}/lists?settings=billing`,
      });
    }),
  );
}
