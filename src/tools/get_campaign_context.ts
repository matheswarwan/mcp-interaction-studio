import { z } from "zod";
import { fetchCampaignContext } from "../api/campaignContext.js";
import { fetchCampaign } from "../api/campaigns.js";
import {
  extractCampaignInsights,
  formatCampaignInsights,
} from "../utils/campaignInsights.js";
import { DatasetParamSchema } from "../types/datasetSchema.js";
import { resolveDataset } from "../utils/dataset.js";

export const GetCampaignContextInputSchema = z.object({
  dataset: DatasetParamSchema,
  campaign_id: z.string().min(1),
  include_raw: z.boolean().optional().default(false),
});

export type GetCampaignContextInput = z.infer<typeof GetCampaignContextInputSchema>;

export const GET_CAMPAIGN_CONTEXT_TOOL = {
  name: "get_campaign_context",
  description:
    "Get runtime context for an Interaction Studio campaign: experiences, messages, and content configuration.",
  inputSchema: {
    type: "object" as const,
    properties: {
      dataset: {
        type: "string",
        description: "Dataset name. Optional if IS_DEFAULT_DATASET is configured.",
      },
      campaign_id: { type: "string", description: "Campaign id from list_campaigns" },
      include_raw: { type: "boolean", description: "Return full raw JSON (default: false)" },
    },
    required: ["campaign_id"],
  },
};

export async function handleGetCampaignContext(
  input: GetCampaignContextInput
): Promise<string> {
  const dataset = resolveDataset(input.dataset);
  const [context, campaign] = await Promise.all([
    fetchCampaignContext(dataset, input.campaign_id),
    fetchCampaign(dataset, input.campaign_id),
  ]);

  if (input.include_raw) {
    return JSON.stringify({ context, campaign }, null, 2);
  }

  const insights = extractCampaignInsights(campaign, context);
  const lines = [
    `Campaign context: ${campaign.name} (${input.campaign_id})`,
    "",
    ...formatCampaignInsights(insights),
  ];

  if (lines.length <= 2) {
    lines.push("(No additional context found — use include_raw for full payload)");
  }

  return lines.join("\n");
}
