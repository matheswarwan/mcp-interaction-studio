import { internalGet } from "./internal.js";

export interface DatasetSummary {
  name: string;
  label: string;
  trackAccounts: boolean;
  defaultUrl: string | null;
  activeCampaignCount: number;
  state: string;
  datasetType: string | null;
}

export async function fetchDatasetSummaries(): Promise<DatasetSummary[]> {
  return internalGet<DatasetSummary[]>(
    "/internal/datasetSummaries/",
    undefined,
    "Failed to list datasets"
  );
}

export interface DatasetDetail {
  datasetName: string;
  datasetLabel: string;
  state: string;
  trackAccounts: boolean;
  trackAnonymousUsers: boolean;
  beaconDisabled: boolean;
  modified?: number;
  manualSegmentIds?: string[];
  [key: string]: unknown;
}

export async function fetchDatasetDetail(dataset: string): Promise<DatasetDetail> {
  return internalGet<DatasetDetail>(
    `/internal/dataset/${dataset}/`,
    undefined,
    `Failed to get dataset "${dataset}"`
  );
}

export async function fetchContentZones(dataset: string): Promise<string[]> {
  return internalGet<string[]>(
    `/internal/dataset/${dataset}/contentZones/`,
    undefined,
    `Failed to list content zones for "${dataset}"`
  );
}
