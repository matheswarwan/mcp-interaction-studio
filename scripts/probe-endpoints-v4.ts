import https from "https";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";

const mcp = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), ".cursor/mcp.json"), "utf8")
);
const env = mcp.mcpServers["interaction-studio"].env;
const baseUrl = env.IS_BASE_URL.replace(/\/$/, "");
const sessionId = env.IS_SESSION_ID;
const dataset = "mathes";

const client = axios.create({
  baseURL: baseUrl,
  httpsAgent: new https.Agent({
    rejectUnauthorized: env.IS_TLS_INSECURE !== "true",
  }),
  headers: {
    Accept: "application/json",
    Cookie: `JSESSIONID=${sessionId}`,
    "X-Requested-With": "XMLHttpRequest",
  },
  validateStatus: () => true,
});

async function tryGet(label: string, url: string, params?: Record<string, string>) {
  const res = await client.get(url, { params });
  const preview = JSON.stringify(res.data).slice(0, 120);
  console.log(`${label}: ${res.status} ${preview}`);
}

async function main() {
  const timeRanges = [
    "Today",
    "Yesterday",
    "Last7Days",
    "Last14Days",
    "Last30Days",
    "Last60Days",
    "Last90Days",
    "AllTime",
    "Lifetime",
    "WeekToDate",
    "MonthToDate",
    "QuarterToDate",
    "YearToDate",
  ];
  for (const tr of timeRanges) {
    await tryGet(tr, `/internal/dataset/${dataset}/campaignSummaries/`, { timeRange: tr });
  }

  const res = await client.get(`/internal/dataset/${dataset}/campaignSummaries/`, {
    params: { timeRange: "Last30Days" },
  });
  if (res.status === 200 && Array.isArray(res.data) && res.data[0]) {
    const c = res.data[0];
    console.log("\nSample campaign keys:", Object.keys(c).join(", "));
    const id = c.id as string;
    const paths = [
      `/internal/dataset/${dataset}/campaign/${id}/`,
      `/internal/dataset/${dataset}/campaigns/${id}/`,
      `/internal/dataset/${dataset}/campaign/${id}`,
      `/internal/campaign/${id}/`,
    ];
    for (const p of paths) {
      await tryGet(p, p);
    }
  }

  const segmentPaths = [
    `/internal/dataset/${dataset}/segments/b/`,
    `/internal/dataset/${dataset}/segmentation/b/`,
    `/internal/dataset/${dataset}/SegmentationMeta/b/segments/`,
    `/internal/dataset/${dataset}/segmentationMeta/b/segments/`,
    `/internal/dataset/${dataset}/service/SegmentationMeta/b/segments/`,
    `/internal/dataset/${dataset}/manualSegmentIds/`,
    `/internal/dataset/${dataset}/manualSegments/list/`,
    `/internal/dataset/${dataset}/segment/list/`,
    `/internal/dataset/${dataset}/segments/list/`,
    `/internal/dataset/${dataset}/segmentConfigs/`,
    `/internal/dataset/${dataset}/segmentConfigSummaries/`,
    `/internal/dataset/${dataset}/segmentSummaries/b/`,
  ];
  console.log("\n=== segments ===");
  for (const p of segmentPaths) {
    await tryGet(p, p);
  }
}

main();
