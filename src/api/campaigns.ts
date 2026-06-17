import { internalGet } from "./internal.js";

export interface CampaignSummary {
  id: string;
  name: string;
  source?: string;
  medium?: string;
  modified?: number;
  state?: string;
  priority?: number;
  [key: string]: unknown;
}

export interface CampaignDetail {
  id: string;
  name: string;
  state?: string;
  created?: number;
  updated?: number;
  priority?: number;
  [key: string]: unknown;
}

export async function fetchCampaignSummaries(
  dataset: string,
  timeRange: string
): Promise<CampaignSummary[]> {
  return internalGet<CampaignSummary[]>(
    `/internal/dataset/${dataset}/campaignSummaries/`,
    { timeRange },
    `Failed to list campaigns for "${dataset}"`
  );
}

export async function fetchCampaign(
  dataset: string,
  campaignId: string
): Promise<CampaignDetail> {
  return internalGet<CampaignDetail>(
    `/internal/dataset/${dataset}/campaign/${campaignId}/`,
    undefined,
    `Failed to get campaign "${campaignId}" in "${dataset}"`
  );
}
