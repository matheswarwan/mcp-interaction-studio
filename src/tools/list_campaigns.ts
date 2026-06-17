import { z } from "zod";
import { fetchCampaignSummaries } from "../api/campaigns.js";
import { DatasetParamSchema } from "../types/datasetSchema.js";
import { resolveDataset } from "../utils/dataset.js";

export const ListCampaignsInputSchema = z.object({
  dataset: DatasetParamSchema,
  time_range: z
    .string()
    .optional()
    .default("pastWeek")
    .describe(
      "Time window: pastDay, pastWeek, pastMonth, pastQuarter, Today, or YYYY-MM-DD..YYYY-MM-DD"
    ),
});

export type ListCampaignsInput = z.infer<typeof ListCampaignsInputSchema>;

export const LIST_CAMPAIGNS_TOOL = {
  name: "list_campaigns",
  description:
    "List campaigns in an Interaction Studio dataset. Returns campaign id, name, state, priority, and last modified time.",
  inputSchema: {
    type: "object" as const,
    properties: {
      dataset: {
        type: "string",
        description: "Dataset name. Optional if IS_DEFAULT_DATASET is configured.",
      },
      time_range: {
        type: "string",
        description:
          "Time window: pastDay, pastWeek, pastMonth, pastQuarter, Today, or YYYY-MM-DD..YYYY-MM-DD. Default: pastWeek",
      },
    },
    required: [],
  },
};

function formatModified(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toISOString().slice(0, 10);
}

export async function handleListCampaigns(input: ListCampaignsInput): Promise<string> {
  const dataset = resolveDataset(input.dataset);
  const campaigns = await fetchCampaignSummaries(dataset, input.time_range);

  if (campaigns.length === 0) {
    return `No campaigns found in dataset "${dataset}" for time range "${input.time_range}".`;
  }

  const lines = campaigns.map((campaign) => {
    const state = campaign.state ?? "—";
    const priority = campaign.priority ?? "—";
    return [
      `• ${campaign.name} (id: ${campaign.id})`,
      `  state: ${state} | priority: ${priority} | modified: ${formatModified(campaign.modified)}`,
    ].join("\n");
  });

  return (
    `Found ${campaigns.length} campaign(s) in "${dataset}" (${input.time_range}):\n\n` +
    lines.join("\n\n")
  );
}
