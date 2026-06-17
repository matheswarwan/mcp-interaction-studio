import { z } from "zod";
import { fetchSurveys } from "../api/surveys.js";
import { DatasetParamSchema } from "../types/datasetSchema.js";
import { resolveDataset } from "../utils/dataset.js";

export const ListSurveysInputSchema = z.object({
  dataset: DatasetParamSchema,
});

export type ListSurveysInput = z.infer<typeof ListSurveysInputSchema>;

export const LIST_SURVEYS_TOOL = {
  name: "list_surveys",
  description: "List surveys configured in an Interaction Studio dataset.",
  inputSchema: {
    type: "object" as const,
    properties: {
      dataset: {
        type: "string",
        description: "Dataset name. Optional if IS_DEFAULT_DATASET is configured.",
      },
    },
    required: [],
  },
};

function formatModified(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toISOString().slice(0, 10);
}

export async function handleListSurveys(input: ListSurveysInput): Promise<string> {
  const dataset = resolveDataset(input.dataset);
  const surveys = await fetchSurveys(dataset);

  if (surveys.length === 0) {
    return `No surveys found in dataset "${dataset}".`;
  }

  const lines = surveys.map((s) => {
    const id = s.id ?? "—";
    const name = s.name ?? "—";
    const state = s.state ?? "—";
    return `• ${name} (id: ${id})\n  state: ${state} | modified: ${formatModified(s.updated)}`;
  });

  return `Found ${surveys.length} survey(s) in "${dataset}":\n\n${lines.join("\n\n")}`;
}
