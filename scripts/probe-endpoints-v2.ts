import "dotenv/config";
import https from "https";
import axios from "axios";

const baseUrl = process.env.IS_BASE_URL?.replace(/\/$/, "");
const sessionId = process.env.IS_SESSION_ID;
const tlsInsecure = process.env.IS_TLS_INSECURE === "true";
const dataset = process.argv[2] ?? "mathes";

if (!baseUrl || !sessionId) process.exit(1);

const client = axios.create({
  baseURL: baseUrl,
  httpsAgent: new https.Agent({ rejectUnauthorized: !tlsInsecure }),
  headers: {
    Accept: "application/json",
    Cookie: `JSESSIONID=${sessionId}`,
    "X-Requested-With": "XMLHttpRequest",
  },
  validateStatus: () => true,
});

const timeRanges = [
  "LAST_7_DAYS",
  "LAST_30_DAYS",
  "LAST_90_DAYS",
  "ALL",
  "all",
  "7d",
  "30d",
  "Last7Days",
  "Last30Days",
  "P7D",
  "P30D",
];

const segmentPaths = [
  `/internal/dataset/${dataset}/segmentation/`,
  `/internal/dataset/${dataset}/segmentationMeta/`,
  `/internal/dataset/${dataset}/segmentsMeta/`,
  `/internal/dataset/${dataset}/manualSegments/`,
  `/internal/dataset/${dataset}/userSegments/`,
  `/internal/dataset/${dataset}/segmentDefinitions/`,
  `/internal/dataset/${dataset}/segmentationMeta/segments/`,
  `/internal/dataset/${dataset}/segmentation/segments/`,
  `/internal/dataset/${dataset}/SegmentationMeta/`,
];

async function main() {
  console.log("=== campaignSummaries timeRange ===");
  for (const tr of timeRanges) {
    const path = `/internal/dataset/${dataset}/campaignSummaries/`;
    const res = await client.get(path, { params: { timeRange: tr } });
    const body = JSON.stringify(res.data).slice(0, 100);
    console.log(`${res.status}\t${tr}\t${body}`);
  }

  console.log("\n=== segment paths ===");
  for (const path of segmentPaths) {
    const res = await client.get(path);
    const body =
      typeof res.data === "string"
        ? res.data.slice(0, 80)
        : JSON.stringify(res.data).slice(0, 100);
    console.log(`${res.status}\t${path}\t${body}`);
  }

  console.log("\n=== dataset detail keys ===");
  const detail = await client.get(`/internal/dataset/${dataset}/`);
  if (detail.status === 200 && typeof detail.data === "object") {
    console.log(Object.keys(detail.data as object).join(", "));
    console.log(JSON.stringify(detail.data).slice(0, 500));
  }
}

main();
