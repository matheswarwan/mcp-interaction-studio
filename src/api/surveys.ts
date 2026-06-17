import { internalGet } from "./internal.js";

export interface SurveySummary {
  id?: string;
  name?: string;
  state?: string;
  created?: number;
  updated?: number;
  [key: string]: unknown;
}

export async function fetchSurveys(dataset: string): Promise<SurveySummary[]> {
  return internalGet<SurveySummary[]>(
    `/internal/dataset/${dataset}/surveys/`,
    undefined,
    `Failed to list surveys for "${dataset}"`
  );
}
