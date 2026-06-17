import { internalGet } from "./internal.js";

export async function fetchCampaignContext(
  dataset: string,
  campaignId: string
): Promise<Record<string, unknown>> {
  return internalGet<Record<string, unknown>>(
    `/internal/dataset/${dataset}/campaign/${campaignId}/context/`,
    undefined,
    `Failed to get context for campaign "${campaignId}" in "${dataset}"`
  );
}
