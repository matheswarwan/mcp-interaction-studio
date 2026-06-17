import {
  ConsumptionDataPoint,
  ConsumptionSeries,
  DatasetDataPoints,
} from "../api/consumption.js";

export function getDatasetSeries(
  series: ConsumptionSeries | undefined,
  dataset: string
): ConsumptionDataPoint[] {
  const entry = series?.datasetDataPoints?.find((d) => d.datasetName === dataset);
  return entry?.dataPoints ?? [];
}

export function sumDataPoints(points: ConsumptionDataPoint[]): number {
  return points.reduce((sum, p) => sum + (p.value ?? 0), 0);
}

export function latestDataPointValue(points: ConsumptionDataPoint[]): number {
  if (points.length === 0) return 0;
  const sorted = [...points].sort((a, b) => b.date - a.date);
  return sorted[0]?.value ?? 0;
}

export function sumDatasetConsumption(
  series: ConsumptionSeries | undefined,
  dataset: string
): number {
  return sumDataPoints(getDatasetSeries(series, dataset));
}

export function latestDatasetConsumption(
  series: ConsumptionSeries | undefined,
  dataset: string
): number {
  return latestDataPointValue(getDatasetSeries(series, dataset));
}

export interface DatasetConsumptionSummary {
  muvTotal: number;
  muvLatestMonth: number;
  nipTotal: number;
  nipLatestMonth: number;
  segmentExports: number;
  campaignStats: number;
  events: number;
  eventErrors: number;
  etlUserExports: number;
  triggeredCampaigns: number;
}

export function buildDatasetConsumptionSummary(
  dataset: string,
  input: {
    muvStats?: ConsumptionSeries;
    visitors?: { muvDataPoints?: ConsumptionSeries; nipDataPoints?: ConsumptionSeries };
    segmentExportStats?: ConsumptionSeries;
    campaignStats?: ConsumptionSeries;
    eventStats?: {
      events?: ConsumptionSeries;
      errors?: ConsumptionSeries;
    };
    etlStats?: { userDataPoints?: ConsumptionSeries };
    triggeredCampaignStats?: { triggeredCampaign?: ConsumptionSeries };
  }
): DatasetConsumptionSummary {
  return {
    muvTotal: sumDatasetConsumption(input.muvStats, dataset),
    muvLatestMonth: latestDatasetConsumption(input.muvStats, dataset),
    nipTotal: sumDatasetConsumption(input.visitors?.nipDataPoints, dataset),
    nipLatestMonth: latestDatasetConsumption(input.visitors?.nipDataPoints, dataset),
    segmentExports: sumDatasetConsumption(input.segmentExportStats, dataset),
    campaignStats: sumDatasetConsumption(input.campaignStats, dataset),
    events: sumDatasetConsumption(input.eventStats?.events, dataset),
    eventErrors: sumDatasetConsumption(input.eventStats?.errors, dataset),
    etlUserExports: sumDatasetConsumption(input.etlStats?.userDataPoints, dataset),
    triggeredCampaigns: sumDatasetConsumption(
      input.triggeredCampaignStats?.triggeredCampaign,
      dataset
    ),
  };
}

export function listDatasetsInSeries(series: ConsumptionSeries | undefined): string[] {
  return (series?.datasetDataPoints ?? []).map((d: DatasetDataPoints) => d.datasetName);
}
