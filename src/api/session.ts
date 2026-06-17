import { getConfig } from "../config.js";
import { fetchDatasetSummaries } from "./datasets.js";

export interface SessionStatus {
  valid: boolean;
  baseUrl: string;
  datasetCount: number;
  defaultDataset?: string;
  datasets: Array<{ name: string; label: string; state: string }>;
}

export async function checkSession(): Promise<SessionStatus> {
  const config = getConfig();
  const datasets = await fetchDatasetSummaries();

  return {
    valid: true,
    baseUrl: config.baseUrl,
    datasetCount: datasets.length,
    defaultDataset: config.defaultDataset,
    datasets: datasets.map((d) => ({
      name: d.name,
      label: d.label,
      state: d.state,
    })),
  };
}
