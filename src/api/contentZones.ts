import { internalGet } from "./internal.js";

export interface ContentZoneLogEntry {
  contentZone?: string;
  name?: string;
  updated?: number;
  [key: string]: unknown;
}

export async function fetchContentZoneLogs(
  dataset: string,
  timeRange: string
): Promise<ContentZoneLogEntry[]> {
  const data = await internalGet<ContentZoneLogEntry[] | Record<string, unknown>>(
    `/internal/dataset/${dataset}/contentZones/logs`,
    { timeRange },
    `Failed to list content zone logs for "${dataset}"`
  );

  if (Array.isArray(data)) return data;
  return [];
}
