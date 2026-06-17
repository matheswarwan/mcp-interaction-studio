import { z } from "zod";
import { DatasetSummary, fetchDatasetSummaries } from "../api/datasets.js";

export const ListDatasetsInputSchema = z.object({});

export type ListDatasetsInput = z.infer<typeof ListDatasetsInputSchema>;

export const LIST_DATASETS_TOOL = {
  name: "list_datasets",
  description:
    "List all Interaction Studio (Marketing Cloud Personalization) datasets available in the connected account. " +
    "Returns each dataset's name, label, state, type, and active campaign count.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

function formatDataset(dataset: DatasetSummary): string {
  const type = dataset.datasetType ?? "—";
  return [
    `• ${dataset.label} (name: ${dataset.name})`,
    `  state: ${dataset.state} | type: ${type} | active campaigns: ${dataset.activeCampaignCount}`,
  ].join("\n");
}

export async function handleListDatasets(_input: ListDatasetsInput): Promise<string> {
  const datasets = await fetchDatasetSummaries();

  if (datasets.length === 0) {
    return "No datasets found.";
  }

  return `Found ${datasets.length} dataset(s):\n\n${datasets.map(formatDataset).join("\n\n")}`;
}
