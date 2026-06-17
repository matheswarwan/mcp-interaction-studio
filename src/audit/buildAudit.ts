import { fetchContentZoneLogs } from "../api/contentZones.js";
import {
  aggregateStats,
  fetchCampaignStats,
  StatSource,
} from "../api/campaignStats.js";
import { fetchCampaignSummaries, fetchCampaign } from "../api/campaigns.js";
import { fetchContentZones, fetchDatasetDetail, DatasetDetail } from "../api/datasets.js";
import { fetchSegmentSummaries } from "../api/segments.js";
import {
  fetchSegmentDetails,
  fetchSegmentStats,
  SegmentStatsEntry,
} from "../api/segmentDetails.js";
import { fetchItemTemplates } from "../api/templates.js";
import { fetchSurveys } from "../api/surveys.js";
import { getConfig } from "../config.js";
import { extractCampaignInsights } from "../utils/campaignInsights.js";
import { buildRecipeUsageReport, RecipeUsageReport } from "../utils/recipeUsage.js";

export interface AuditCampaignStats {
  impressions: number;
  clickthroughs: number;
  uniqueUsers: number;
  goalAchievements: number;
  orders: number;
  revenue: number;
  dismissals: number;
  hasControlGroup: boolean;
}

export interface AuditCampaignEntry {
  id: string;
  name: string;
  state?: string;
  campaignType?: string;
  medium?: string;
  priority?: number;
  modified?: number;
  updated?: number;
  insights: ReturnType<typeof extractCampaignInsights>;
  statsQuarter: AuditCampaignStats;
  statsYear: AuditCampaignStats;
}

export interface AuditSegmentEntry {
  id: string;
  name: string;
  folder?: string;
  modified?: number;
  enabled?: boolean;
  memberCount?: number;
  startMemberCount?: number;
  endMemberCount?: number;
  calcStatus?: string;
}

export interface AuditFinding {
  severity: "high" | "medium" | "low";
  finding: string;
  recommendation: string;
}

export interface DatasetAudit {
  dataset: string;
  label: string;
  generatedAt: string;
  instanceUrl: string;
  timeRange: string;
  statsYearRange: string;
  datasetDetail: DatasetDetail;
  contentZones: string[];
  campaigns: AuditCampaignEntry[];
  segments: AuditSegmentEntry[];
  templateCount: number;
  templates: Array<{ id: string; name: string; state?: string; itemType?: string }>;
  recipeUsage: RecipeUsageReport;
  surveyCount: number;
  contentZoneLogCount: number;
  findings: AuditFinding[];
}

function toAuditStats(
  totals: StatSource,
  hasControlGroup?: boolean
): AuditCampaignStats {
  return {
    impressions: totals.impressions ?? 0,
    clickthroughs: totals.clickthroughs ?? 0,
    uniqueUsers: totals.uniqueUsers ?? 0,
    goalAchievements: totals.initialGoalAchievements ?? 0,
    orders: totals.orders ?? 0,
    revenue: totals.totalRevenue ?? 0,
    dismissals: totals.dismissals ?? 0,
    hasControlGroup: hasControlGroup === true,
  };
}

async function fetchCampaignAuditStats(
  dataset: string,
  campaignId: string,
  timeRange: string
): Promise<AuditCampaignStats> {
  try {
    const stats = await fetchCampaignStats(dataset, campaignId, timeRange);
    return toAuditStats(
      aggregateStats(stats.totalStats?.bucketedStats),
      stats.hasControlGroup
    );
  } catch {
    return toAuditStats({});
  }
}

function pickEnabled(details: Record<string, unknown>): boolean | undefined {
  if (details.disabled === true) return false;
  if (details.disabled === false) return true;
  if (details.enabled === true) return true;
  if (details.enabled === false) return false;
  return undefined;
}

function buildFindings(audit: Omit<DatasetAudit, "findings">): AuditFinding[] {
  const findings: AuditFinding[] = [];

  const disabled = audit.campaigns.filter((c) => c.state === "Disabled");
  if (disabled.length > 0) {
    findings.push({
      severity: "medium",
      finding: `${disabled.length} disabled campaign(s) remain in the dataset`,
      recommendation: `Review for archival: ${disabled.map((c) => c.name).join(", ")}`,
    });
  }

  const testCampaigns = audit.campaigns.filter((c) =>
    /^(test|demo)/i.test(c.name.trim())
  );
  if (testCampaigns.length > 0) {
    findings.push({
      severity: "low",
      finding: `${testCampaigns.length} test/demo campaign(s) detected`,
      recommendation: "Remove test artifacts from shared datasets if not needed",
    });
  }

  const yearActive = audit.campaigns.filter((c) => c.statsYear.impressions > 0);
  if (yearActive.length === 0) {
    findings.push({
      severity: "high",
      finding: "No campaign impressions recorded in the stats year window",
      recommendation:
        "Verify beacon deployment, dataset tagging, and that campaigns target live content zones",
    });
  } else if (yearActive.length === 1) {
    findings.push({
      severity: "medium",
      finding: `Only one campaign has impressions in ${audit.statsYearRange}: ${yearActive[0].name}`,
      recommendation: "Investigate why other published campaigns show zero traffic",
    });
  }

  if (audit.recipeUsage.unlinkedRecipeIds.length > 0) {
    findings.push({
      severity: "medium",
      finding: `${audit.recipeUsage.unlinkedRecipeIds.length} recipe(s) not linked to any campaign`,
      recommendation: `Re-link or retire: ${audit.recipeUsage.unlinkedRecipeIds.join(", ")}`,
    });
  }

  const apiUnusedButLinked = audit.recipeUsage.recipes.filter(
    (r: RecipeUsageReport["recipes"][number]) => !r.inUseFlag && r.campaigns.length > 0
  );
  if (apiUnusedButLinked.length > 0) {
    findings.push({
      severity: "low",
      finding:
        "Some recipes are linked to campaigns but API inUse flag is false (flag may be stale)",
      recommendation: apiUnusedButLinked.map((r) => r.recipeName).join(", "),
    });
  }

  if (audit.surveyCount === 0) {
    findings.push({
      severity: "low",
      finding: "No surveys configured",
      recommendation: "Add surveys only if feedback collection is required",
    });
  }

  if (audit.datasetDetail.beaconDisabled) {
    findings.push({
      severity: "high",
      finding: "Beacon is disabled on this dataset",
      recommendation: "Enable beacon tracking for web personalization campaigns",
    });
  }

  const zeroMemberSegments = audit.segments.filter(
    (s) => s.endMemberCount === 0 && s.startMemberCount === 0
  );
  if (zeroMemberSegments.length === audit.segments.length && audit.segments.length > 0) {
    findings.push({
      severity: "medium",
      finding: "All segments show zero members in the selected time range",
      recommendation: "Confirm segment rules are calculating and traffic is reaching the dataset",
    });
  }

  return findings;
}

export interface BuildAuditOptions {
  dataset: string;
  timeRange?: string;
  statsYearRange?: string;
}

export async function buildDatasetAudit(
  options: BuildAuditOptions
): Promise<DatasetAudit> {
  const dataset = options.dataset;
  const timeRange = options.timeRange ?? "pastQuarter";
  const year = new Date().getFullYear();
  const statsYearRange =
    options.statsYearRange ?? `${year}-01-01..${year}-12-31`;

  const [
    datasetDetail,
    contentZones,
    campaignSummaries,
    segmentSummaries,
    templates,
    recipeUsage,
    surveys,
    contentZoneLogs,
  ] = await Promise.all([
    fetchDatasetDetail(dataset),
    fetchContentZones(dataset),
    fetchCampaignSummaries(dataset, timeRange),
    fetchSegmentSummaries(dataset),
    fetchItemTemplates(dataset),
    buildRecipeUsageReport(dataset, timeRange),
    fetchSurveys(dataset).catch(() => []),
    fetchContentZoneLogs(dataset, timeRange).catch(() => []),
  ]);

  const segmentIds = segmentSummaries
    .map((s) => s.itemSourceId)
    .filter((id): id is string => typeof id === "string");

  let segmentStatsMap = new Map<string, SegmentStatsEntry>();
  if (segmentIds.length > 0) {
    try {
      const stats = await fetchSegmentStats(dataset, segmentIds, timeRange);
      for (const entry of stats) {
        const id = entry.id ?? entry.segmentId;
        if (typeof id === "string") segmentStatsMap.set(id, entry);
      }
    } catch {
      segmentStatsMap = new Map();
    }
  }

  const segments: AuditSegmentEntry[] = [];
  for (const summary of segmentSummaries) {
    const id = summary.itemSourceId;
    if (!id) continue;

    let details: Record<string, unknown> = {};
    try {
      details = (await fetchSegmentDetails(dataset, id, timeRange)) as Record<
        string,
        unknown
      >;
    } catch {
      details = {};
    }

    const stats = segmentStatsMap.get(id);
    const calcStatus =
      typeof stats?.mostRecentNightlyCalcStatus === "string"
        ? stats.mostRecentNightlyCalcStatus
        : typeof stats?.currentStatus === "string"
          ? stats.currentStatus
          : undefined;

    segments.push({
      id,
      name: summary.name ?? (typeof details.name === "string" ? details.name : id),
      folder: summary.folderObjectName,
      modified: summary.updated,
      enabled: pickEnabled(details),
      memberCount:
        typeof details.memberCount === "number" ? details.memberCount : undefined,
      startMemberCount:
        typeof stats?.startMemberCount === "number" ? stats.startMemberCount : undefined,
      endMemberCount:
        typeof stats?.endMemberCount === "number" ? stats.endMemberCount : undefined,
      calcStatus,
    });
  }

  const campaigns: AuditCampaignEntry[] = [];
  for (const summary of campaignSummaries) {
    const [campaign, statsQuarter, statsYear] = await Promise.all([
      fetchCampaign(dataset, summary.id),
      fetchCampaignAuditStats(dataset, summary.id, timeRange),
      fetchCampaignAuditStats(dataset, summary.id, statsYearRange),
    ]);

    const extra = campaign as Record<string, unknown>;
    campaigns.push({
      id: summary.id,
      name: summary.name,
      state: summary.state ?? campaign.state,
      campaignType:
        typeof extra.campaignType === "string" ? extra.campaignType : undefined,
      medium: typeof extra.medium === "string" ? extra.medium : summary.medium,
      priority: summary.priority ?? campaign.priority,
      modified: summary.modified,
      updated: campaign.updated,
      insights: extractCampaignInsights(campaign),
      statsQuarter,
      statsYear,
    });
  }

  const base: Omit<DatasetAudit, "findings"> = {
    dataset,
    label: datasetDetail.datasetLabel ?? dataset,
    generatedAt: new Date().toISOString(),
    instanceUrl: getConfig().baseUrl,
    timeRange,
    statsYearRange,
    datasetDetail,
    contentZones,
    campaigns,
    segments,
    templateCount: templates.length,
    templates: templates.map((t: { id: string; name: string; state?: string; itemType?: { itemType?: string } }) => ({
      id: t.id,
      name: t.name,
      state: t.state,
      itemType: t.itemType?.itemType,
    })),
    recipeUsage,
    surveyCount: Array.isArray(surveys) ? surveys.length : 0,
    contentZoneLogCount: contentZoneLogs.length,
  };

  return {
    ...base,
    findings: buildFindings(base),
  };
}
