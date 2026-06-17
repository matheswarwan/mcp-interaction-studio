import { internalGet } from "./internal.js";

export interface SegmentDetails {
  id?: string;
  name?: string;
  memberCount?: number;
  enabled?: boolean;
  customerType?: string;
  created?: number;
  updated?: number;
  lastUpdated?: number;
  description?: string;
  [key: string]: unknown;
}

export interface SegmentStatsEntry {
  segmentId?: string;
  id?: string;
  name?: string;
  memberCount?: number;
  userCount?: number;
  count?: number;
  [key: string]: unknown;
}

export async function fetchSegmentDetails(
  dataset: string,
  segmentId: string,
  timeRange = "pastWeek"
): Promise<SegmentDetails> {
  return internalGet<SegmentDetails>(
    `/internal/dataset/${dataset}/segmentDetails/${segmentId}/`,
    { timeRange },
    `Failed to get segment details for "${segmentId}" in "${dataset}"`
  );
}

export async function fetchSegmentStats(
  dataset: string,
  segmentIds: string[],
  timeRange = "pastWeek"
): Promise<SegmentStatsEntry[]> {
  return internalGet<SegmentStatsEntry[]>(
    `/internal/dataset/${dataset}/segmentSummaries/segments/stats`,
    { segmentIds: segmentIds.join(","), timeRange },
    `Failed to get segment stats in "${dataset}"`
  );
}

export async function fetchGlobalSegmentStats(
  dataset: string
): Promise<SegmentStatsEntry[] | Record<string, unknown>> {
  return internalGet<SegmentStatsEntry[] | Record<string, unknown>>(
    `/internal/dataset/${dataset}/global/segmentStats`,
    undefined,
    `Failed to get global segment stats for "${dataset}"`
  );
}
