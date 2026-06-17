import { internalGet } from "./internal.js";

export interface ConsumptionDataPoint {
  date: number;
  value: number;
}

export interface DatasetDataPoints {
  datasetName: string;
  dataPoints: ConsumptionDataPoint[];
}

export interface ConsumptionSeries {
  datasetDataPoints?: DatasetDataPoints[];
  total?: ConsumptionDataPoint[];
}

export interface AccountLimits {
  muv?: number;
  nip?: number;
}

export interface VisitorsConsumption {
  muvDataPoints?: ConsumptionSeries;
  nipDataPoints?: ConsumptionSeries;
}

export interface EventStatsConsumption {
  total?: ConsumptionSeries;
  events?: ConsumptionSeries;
  errors?: ConsumptionSeries;
}

export interface TriggeredCampaignStatsConsumption {
  total?: ConsumptionSeries;
  triggeredCampaign?: ConsumptionSeries;
  triggeredMobilePushCampaign?: ConsumptionSeries;
}

export interface EtlStatsConsumption {
  total?: ConsumptionSeries;
  accountDataPoints?: ConsumptionSeries;
  catalogObjectDataPoints?: ConsumptionSeries;
  categoryDataPoints?: ConsumptionSeries;
  catalogLocalizationDataPoints?: ConsumptionSeries;
  externalEmailCampaignEventDataPoints?: ConsumptionSeries;
  manualSegmentationDataPoints?: ConsumptionSeries;
  productDataPoints?: ConsumptionSeries;
  productLocalizationDataPoints?: ConsumptionSeries;
  promotionDataPoints?: ConsumptionSeries;
  userDataPoints?: ConsumptionSeries;
  transactionDataPoints?: ConsumptionSeries;
  userProfileObjectDataPoints?: ConsumptionSeries;
  [key: string]: ConsumptionSeries | undefined;
}

export interface ConsumptionTimeRange {
  start: number;
  end: number;
}

function consumptionPath(endpoint: string, range?: ConsumptionTimeRange): string {
  if (!range) return `/internal/consumption/${endpoint}`;
  return `/internal/consumption/${endpoint}?start=${range.start}&end=${range.end}`;
}

export async function fetchAccountLimits(): Promise<AccountLimits> {
  return internalGet<AccountLimits>(
    "/internal/consumption/accountLimits",
    undefined,
    "Failed to fetch consumption account limits"
  );
}

export async function fetchVisitorsConsumption(
  range: ConsumptionTimeRange
): Promise<VisitorsConsumption> {
  return internalGet<VisitorsConsumption>(
    consumptionPath("visitors", range),
    undefined,
    "Failed to fetch consumption visitors"
  );
}

export async function fetchMuvStats(range: ConsumptionTimeRange): Promise<ConsumptionSeries> {
  return internalGet<ConsumptionSeries>(
    consumptionPath("muvStats", range),
    undefined,
    "Failed to fetch consumption muvStats"
  );
}

export async function fetchSegmentExportStats(
  range: ConsumptionTimeRange
): Promise<ConsumptionSeries> {
  return internalGet<ConsumptionSeries>(
    consumptionPath("segmentExportStats", range),
    undefined,
    "Failed to fetch consumption segmentExportStats"
  );
}

export async function fetchEtlStats(range: ConsumptionTimeRange): Promise<EtlStatsConsumption> {
  return internalGet<EtlStatsConsumption>(
    consumptionPath("etlStats", range),
    undefined,
    "Failed to fetch consumption etlStats"
  );
}

export async function fetchConsumptionCampaignStats(
  range: ConsumptionTimeRange
): Promise<ConsumptionSeries> {
  return internalGet<ConsumptionSeries>(
    consumptionPath("campaignStats", range),
    undefined,
    "Failed to fetch consumption campaignStats"
  );
}

export async function fetchEventStats(range: ConsumptionTimeRange): Promise<EventStatsConsumption> {
  return internalGet<EventStatsConsumption>(
    consumptionPath("eventStats", range),
    undefined,
    "Failed to fetch consumption eventStats"
  );
}

export async function fetchTriggeredCampaignStats(
  range: ConsumptionTimeRange
): Promise<TriggeredCampaignStatsConsumption> {
  return internalGet<TriggeredCampaignStatsConsumption>(
    consumptionPath("triggeredCampaignStats", range),
    undefined,
    "Failed to fetch consumption triggeredCampaignStats"
  );
}

export function defaultConsumptionRange(): ConsumptionTimeRange {
  const end = Date.now();
  const start = end - 365 * 24 * 60 * 60 * 1000;
  return { start, end };
}
