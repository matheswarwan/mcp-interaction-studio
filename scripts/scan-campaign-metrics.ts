import "dotenv/config";
import fs from "fs";
import os from "os";
import { fetchCampaignSummaries } from "../dist/api/campaigns.js";
import { aggregateStats, fetchCampaignStats } from "../dist/api/campaignStats.js";

const env = JSON.parse(
  fs.readFileSync(`${os.homedir()}/.cursor/mcp.json`, "utf8")
).mcpServers["interaction-studio"].env;

process.env.IS_BASE_URL = env.IS_BASE_URL;
process.env.IS_SESSION_ID = env.IS_SESSION_ID;
process.env.IS_TLS_INSECURE = env.IS_TLS_INSECURE;

const dataset = process.argv[2] ?? "eharper";
const timeRange = process.argv[3] ?? "pastQuarter";

async function main() {
  const campaigns = await fetchCampaignSummaries(dataset, timeRange);
  const withMetrics: Array<{
    id: string;
    name: string;
    impressions: number;
    clickthroughs: number;
    uniqueUsers: number;
    goals: number;
    orders: number;
  }> = [];

  for (const campaign of campaigns) {
    const stats = await fetchCampaignStats(dataset, campaign.id, timeRange);
    const totals = aggregateStats(stats.totalStats?.bucketedStats);
    const activity =
      (totals.impressions ?? 0) +
      (totals.clickthroughs ?? 0) +
      (totals.uniqueUsers ?? 0);

    if (activity > 0) {
      withMetrics.push({
        id: campaign.id,
        name: campaign.name,
        impressions: totals.impressions ?? 0,
        clickthroughs: totals.clickthroughs ?? 0,
        uniqueUsers: totals.uniqueUsers ?? 0,
        goals: totals.initialGoalAchievements ?? 0,
        orders: totals.orders ?? 0,
      });
    }
  }

  console.log(`Dataset: ${dataset} | time range: ${timeRange}`);
  console.log(`Scanned ${campaigns.length} campaign(s)\n`);

  if (withMetrics.length === 0) {
    console.log("No campaigns with activity in this period.");
    return;
  }

  withMetrics.sort(
    (a, b) =>
      b.impressions +
      b.clickthroughs -
      (a.impressions + a.clickthroughs)
  );

  for (const c of withMetrics) {
    console.log(
      `• ${c.name} (${c.id})\n` +
        `  ${c.impressions} impressions | ${c.clickthroughs} clicks | ${c.uniqueUsers} users | ${c.goals} goals | ${c.orders} orders`
    );
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
