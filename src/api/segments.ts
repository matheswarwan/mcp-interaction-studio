import { internalGet } from "./internal.js";

export interface SegmentListItem {
  itemSourceId?: string;
  name?: string;
  itemType?: string | null;
  updated?: number;
  folderSourceId?: string;
  folderObjectName?: string;
  [key: string]: unknown;
}

export async function fetchSegmentSummaries(dataset: string): Promise<SegmentListItem[]> {
  return internalGet<SegmentListItem[]>(
    `/internal/dataset/${dataset}/segmentSummaries/listAll`,
    undefined,
    `Failed to list segments for "${dataset}"`
  );
}

export interface SegmentDetail {
  id?: string;
  name?: string;
  customerType?: string;
  enabled?: boolean;
  created?: number;
  updated?: number;
  lastUpdated?: number;
  description?: string;
  segmentRuleSummaries?: SegmentRuleSummary[];
  [key: string]: unknown;
}

export interface SegmentRuleSummary {
  id?: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

export async function fetchSegment(
  dataset: string,
  segmentId: string
): Promise<SegmentDetail> {
  return internalGet<SegmentDetail>(
    `/internal/dataset/${dataset}/segments/${segmentId}/`,
    undefined,
    `Failed to get segment "${segmentId}" in "${dataset}"`
  );
}

export async function fetchSegmentRuleSummaries(
  dataset: string,
  segmentId: string
): Promise<SegmentRuleSummary[]> {
  return internalGet<SegmentRuleSummary[]>(
    `/internal/dataset/${dataset}/segmentRuleSummaries/${segmentId}/`,
    undefined,
    `Failed to get segment rules for "${segmentId}" in "${dataset}"`
  );
}
