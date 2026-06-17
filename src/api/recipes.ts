import { internalGet } from "./internal.js";

export interface RecipeSummary {
  id: string;
  name: string;
  created?: number;
  updated?: number;
  liveRecipeSummary?: {
    id?: string;
    name?: string;
    itemTypeToRecommend?: { itemType?: string };
    inUse?: boolean;
    needsTraining?: boolean;
  };
  [key: string]: unknown;
}

export async function fetchRecipeSummaries(dataset: string): Promise<RecipeSummary[]> {
  return internalGet<RecipeSummary[]>(
    `/internal/dataset/${dataset}/recipeSummaries/listAll`,
    undefined,
    `Failed to list recipes for "${dataset}"`
  );
}
