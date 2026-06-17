import { internalGet } from "./internal.js";
import { timeRangeToBounds } from "../utils/timeRangeBounds.js";

export interface StatSource {
  uniqueUsers?: number;
  impressions?: number;
  clickthroughs?: number;
  dismissals?: number;
  initialGoalAchievements?: number;
  orders?: number;
  totalRevenue?: number;
  [key: string]: unknown;
}

export interface CampaignStatsResponse {
  startTime?: number;
  endTime?: number;
  totalStats?: { bucketedStats?: Record<string, { source?: StatSource }> };
  experienceStats?: Record<
    string,
    { bucketedStats?: Record<string, { source?: StatSource }> }
  >;
  hasControlGroup?: boolean;
  [key: string]: unknown;
}

export function aggregateStats(
  bucketedStats?: Record<string, { source?: StatSource }>
): StatSource {
  const totals: StatSource = {
    uniqueUsers: 0,
    impressions: 0,
    clickthroughs: 0,
    dismissals: 0,
    initialGoalAchievements: 0,
    orders: 0,
    totalRevenue: 0,
  };

  for (const bucket of Object.values(bucketedStats ?? {})) {
    const s = bucket.source ?? {};
    totals.uniqueUsers! += s.uniqueUsers ?? 0;
    totals.impressions! += s.impressions ?? 0;
    totals.clickthroughs! += s.clickthroughs ?? 0;
    totals.dismissals! += s.dismissals ?? 0;
    totals.initialGoalAchievements! += s.initialGoalAchievements ?? 0;
    totals.orders! += s.orders ?? 0;
    totals.totalRevenue! += s.totalRevenue ?? 0;
  }

  return totals;
}

export async function fetchCampaignStats(
  dataset: string,
  campaignId: string,
  timeRange: string
): Promise<CampaignStatsResponse> {
  const { start, end } = timeRangeToBounds(timeRange);

  return internalGet<CampaignStatsResponse>(
    `/internal/dataset/${dataset}/campaignStats/${campaignId}/`,
    { start, end },
    `Failed to get stats for campaign "${campaignId}" in "${dataset}"`
  );
}
