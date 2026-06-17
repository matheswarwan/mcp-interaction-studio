import { z } from "zod";
import {
  aggregateStats,
  fetchCampaignStats,
} from "../api/campaignStats.js";
import { DatasetParamSchema } from "../types/datasetSchema.js";
import { resolveDataset } from "../utils/dataset.js";

export const GetCampaignStatsInputSchema = z.object({
  dataset: DatasetParamSchema,
  campaign_id: z.string().min(1).describe("Campaign id from list_campaigns"),
  time_range: z
    .string()
    .optional()
    .default("pastWeek")
    .describe(
      "pastDay, pastWeek, pastMonth, pastQuarter, Today, or YYYY-MM-DD..YYYY-MM-DD"
    ),
});

export type GetCampaignStatsInput = z.infer<typeof GetCampaignStatsInputSchema>;

export const GET_CAMPAIGN_STATS_TOOL = {
  name: "get_campaign_stats",
  description:
    "Get performance stats for an Interaction Studio campaign: impressions, clicks, goals, orders, and revenue.",
  inputSchema: {
    type: "object" as const,
    properties: {
      dataset: {
        type: "string",
        description: "Dataset name. Optional if IS_DEFAULT_DATASET is configured.",
      },
      campaign_id: { type: "string", description: "Campaign id from list_campaigns" },
      time_range: {
        type: "string",
        description: "pastDay, pastWeek (default), pastMonth, pastQuarter, Today, or YYYY-MM-DD..YYYY-MM-DD",
      },
    },
    required: ["campaign_id"],
  },
};

function formatStatLine(label: string, value: number | undefined): string {
  return `  ${label}: ${value ?? 0}`;
}

export async function handleGetCampaignStats(
  input: GetCampaignStatsInput
): Promise<string> {
  const dataset = resolveDataset(input.dataset);
  const stats = await fetchCampaignStats(dataset, input.campaign_id, input.time_range);

  const totals = aggregateStats(stats.totalStats?.bucketedStats);

  const experienceIds = Object.keys(stats.experienceStats ?? {});
  const lines = [
    `Campaign stats: ${input.campaign_id} in "${dataset}" (${input.time_range})`,
    "",
    "Totals:",
    formatStatLine("Impressions", totals.impressions),
    formatStatLine("Clickthroughs", totals.clickthroughs),
    formatStatLine("Unique users", totals.uniqueUsers),
    formatStatLine("Goal achievements", totals.initialGoalAchievements),
    formatStatLine("Orders", totals.orders),
    formatStatLine("Revenue", totals.totalRevenue),
    formatStatLine("Dismissals", totals.dismissals),
  ];

  if (stats.hasControlGroup) {
    lines.push("", "Has control group: yes");
  }

  if (experienceIds.length > 0) {
    lines.push("", `Experiences (${experienceIds.length}):`);
    for (const expId of experienceIds) {
      const expStats = aggregateStats(
        stats.experienceStats?.[expId]?.bucketedStats
      );
      lines.push(
        `  • ${expId}: ${expStats.impressions} impressions, ${expStats.clickthroughs} clicks, ${expStats.uniqueUsers} users`
      );
    }
  }

  return lines.join("\n");
}
