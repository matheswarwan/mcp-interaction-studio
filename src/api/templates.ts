import { internalGet } from "./internal.js";

export interface ItemTemplate {
  id: string;
  name: string;
  state?: string;
  templateType?: string;
  itemType?: { itemType?: string };
  width?: number;
  height?: number;
  campaignId?: string | null;
  [key: string]: unknown;
}

export async function fetchItemTemplates(dataset: string): Promise<ItemTemplate[]> {
  return internalGet<ItemTemplate[]>(
    `/internal/dataset/${dataset}/itemTemplates/`,
    undefined,
    `Failed to list templates for "${dataset}"`
  );
}
