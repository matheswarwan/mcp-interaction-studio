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
  httpsAgent: new https.Agent({ rejectUnauthorized: env.IS_TLS_INSECURE !== "true" ? true : false }),
  headers: {
    Accept: "application/json",
    Cookie: `JSESSIONID=${sessionId}`,
    "X-Requested-With": "XMLHttpRequest",
  },
  validateStatus: () => true,
});

async function tryGet(label: string, url: string, params?: Record<string, string>) {
  const res = await client.get(url, { params });
  console.log(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 150)}`);
}

async function tryPost(label: string, url: string, data?: unknown) {
  const res = await client.post(url, data ?? {});
  console.log(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 150)}`);
}

async function main() {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const timeRanges = [
    `${weekAgo},${now}`,
    `${weekAgo}-${now}`,
    "LastWeek",
    "LastMonth",
    "LastQuarter",
    "Today",
    "Yesterday",
    "ThisWeek",
    "ThisMonth",
    "Rolling7Days",
    "Rolling30Days",
    "7",
    "30",
    "90",
    "default",
  ];

  for (const tr of timeRanges) {
    await tryGet(`timeRange=${tr}`, `/internal/dataset/${dataset}/campaignSummaries/`, { timeRange: tr });
  }

  await tryGet("start/end", `/internal/dataset/${dataset}/campaignSummaries/`, {
    start: String(weekAgo),
    end: String(now),
  });

  await tryPost("manualSegments POST empty", `/internal/dataset/${dataset}/manualSegments/`);
  await tryPost("segments POST empty", `/internal/dataset/${dataset}/segments/`);

  const morePaths = [
    `/internal/dataset/${dataset}/manualSegments`,
    `/internal/dataset/${dataset}/SegmentationMeta/b/`,
    `/internal/dataset/${dataset}/segmentationMeta/b/`,
    `/internal/service/SegmentationMeta/b/dataset/${dataset}/segments/`,
    `/internal/SegmentationMeta/b/dataset/${dataset}/`,
  ];
  for (const p of morePaths) {
    await tryGet(p, p);
  }
}

main();
