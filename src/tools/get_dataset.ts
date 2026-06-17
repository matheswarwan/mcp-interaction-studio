import { z } from "zod";
import { fetchContentZones, fetchDatasetDetail } from "../api/datasets.js";
import { DatasetParamSchema } from "../types/datasetSchema.js";
import { resolveDataset } from "../utils/dataset.js";

export const GetDatasetInputSchema = z.object({
  dataset: DatasetParamSchema,
  include_content_zones: z
    .boolean()
    .optional()
    .default(true)
    .describe("Also list content zone names configured in the dataset"),
});

export type GetDatasetInput = z.infer<typeof GetDatasetInputSchema>;

export const GET_DATASET_TOOL = {
  name: "get_dataset",
  description:
    "Get Interaction Studio dataset metadata including label, state, tracking settings, and content zones.",
  inputSchema: {
    type: "object" as const,
    properties: {
      dataset: {
        type: "string",
        description: "Dataset name. Optional if IS_DEFAULT_DATASET is configured.",
      },
      include_content_zones: {
        type: "boolean",
        description: "Include content zone names (default: true)",
      },
    },
    required: [],
  },
};

export async function handleGetDataset(input: GetDatasetInput): Promise<string> {
  const dataset = resolveDataset(input.dataset);
  const detail = await fetchDatasetDetail(dataset);
  const zones = input.include_content_zones
    ? await fetchContentZones(dataset)
    : [];

  const lines = [
    `Dataset: ${detail.datasetLabel} (name: ${detail.datasetName})`,
    `State: ${detail.state}`,
    `Track accounts: ${detail.trackAccounts}`,
    `Track anonymous users: ${detail.trackAnonymousUsers}`,
    `Beacon disabled: ${detail.beaconDisabled}`,
  ];

  if (detail.modified) {
    lines.push(`Modified: ${new Date(detail.modified).toISOString()}`);
  }

  if (input.include_content_zones) {
    lines.push(
      zones.length > 0
        ? `Content zones: ${zones.join(", ")}`
        : "Content zones: none"
    );
  }

  return lines.join("\n");
}
