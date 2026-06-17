import { z } from "zod";
import {
  buildRecipeUsageReport,
  formatRecipeUsageReport,
} from "../utils/recipeUsage.js";
import { DatasetParamSchema } from "../types/datasetSchema.js";
import { resolveDataset } from "../utils/dataset.js";

export const GetRecipeUsageInputSchema = z.object({
  dataset: DatasetParamSchema,
  recipe_id: z.string().optional(),
  time_range: z.string().optional().default("pastQuarter"),
  include_raw: z.boolean().optional().default(false),
});

export type GetRecipeUsageInput = z.infer<typeof GetRecipeUsageInputSchema>;

export const GET_RECIPE_USAGE_TOOL = {
  name: "get_recipe_usage",
  description:
    "Map recommendation recipes to campaigns by scanning experience configuration. Resolves API inUse flag vs actual campaign linkage.",
  inputSchema: {
    type: "object" as const,
    properties: {
      dataset: {
        type: "string",
        description: "Dataset name. Optional if IS_DEFAULT_DATASET is configured.",
      },
      recipe_id: {
        type: "string",
        description: "Optional recipe id to filter; omit for all recipes",
      },
      time_range: {
        type: "string",
        description: "Campaign list window (default: pastQuarter)",
      },
      include_raw: {
        type: "boolean",
        description: "Return raw JSON report (default: false)",
      },
    },
    required: [],
  },
};

export async function handleGetRecipeUsage(
  input: GetRecipeUsageInput
): Promise<string> {
  const dataset = resolveDataset(input.dataset);
  const report = await buildRecipeUsageReport(dataset, input.time_range ?? "pastQuarter");

  if (input.recipe_id) {
    const filtered = report.recipes.filter((r) => r.recipeId === input.recipe_id);
    if (filtered.length === 0) {
      return `Recipe "${input.recipe_id}" not found in dataset "${dataset}".`;
    }
    if (input.include_raw) {
      return JSON.stringify({ ...report, recipes: filtered }, null, 2);
    }
    return formatRecipeUsageReport({ ...report, recipes: filtered });
  }

  if (input.include_raw) {
    return JSON.stringify(report, null, 2);
  }

  return formatRecipeUsageReport(report);
}
