import { z } from "zod";
import { fetchRecipeSummaries } from "../api/recipes.js";
import { DatasetParamSchema } from "../types/datasetSchema.js";
import { resolveDataset } from "../utils/dataset.js";

export const ListRecipesInputSchema = z.object({
  dataset: DatasetParamSchema,
});

export type ListRecipesInput = z.infer<typeof ListRecipesInputSchema>;

export const LIST_RECIPES_TOOL = {
  name: "list_recipes",
  description:
    "List recommendation recipes in an Interaction Studio dataset.",
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

export async function handleListRecipes(input: ListRecipesInput): Promise<string> {
  const dataset = resolveDataset(input.dataset);
  const recipes = await fetchRecipeSummaries(dataset);

  if (recipes.length === 0) {
    return `No recipes found in dataset "${dataset}".`;
  }

  const lines = recipes.map((r) => {
    const live = r.liveRecipeSummary;
    const itemType = live?.itemTypeToRecommend?.itemType ?? "—";
    const inUse = live?.inUse ? "yes" : "no";
    const needsTraining = live?.needsTraining ? "yes" : "no";
    return [
      `• ${r.name} (id: ${r.id})`,
      `  item type: ${itemType} | in use: ${inUse} | needs training: ${needsTraining} | modified: ${formatModified(r.updated)}`,
    ].join("\n");
  });

  return `Found ${recipes.length} recipe(s) in "${dataset}":\n\n${lines.join("\n\n")}`;
}
