import { z } from "zod";
import { fetchCampaign } from "../api/campaigns.js";
import { DatasetParamSchema } from "../types/datasetSchema.js";
import { resolveDataset } from "../utils/dataset.js";
import { formatCampaignSummary } from "../utils/formatCampaign.js";

export const GetCampaignInputSchema = z.object({
  dataset: DatasetParamSchema,
  campaign_id: z.string().min(1).describe("Campaign id from list_campaigns"),
  include_raw: z
    .boolean()
    .optional()
    .default(false)
    .describe("Return full raw JSON instead of a formatted summary"),
});

export type GetCampaignInput = z.infer<typeof GetCampaignInputSchema>;

export const GET_CAMPAIGN_TOOL = {
  name: "get_campaign",
  description:
    "Get details for a single Interaction Studio campaign, including state, targeting, and experiences.",
  inputSchema: {
    type: "object" as const,
    properties: {
      dataset: {
        type: "string",
        description: "Dataset name. Optional if IS_DEFAULT_DATASET is configured.",
      },
      campaign_id: {
        type: "string",
        description: "Campaign id from list_campaigns",
      },
      include_raw: {
        type: "boolean",
        description: "Return full raw JSON (default: false)",
      },
    },
    required: ["campaign_id"],
  },
};

export async function handleGetCampaign(input: GetCampaignInput): Promise<string> {
  const dataset = resolveDataset(input.dataset);
  const campaign = await fetchCampaign(dataset, input.campaign_id);

  if (input.include_raw) {
    return JSON.stringify(campaign, null, 2);
  }

  return formatCampaignSummary(campaign);
}
