import "dotenv/config";
import https from "https";
import axios from "axios";

const baseUrl = process.env.IS_BASE_URL?.replace(/\/$/, "");
const sessionId = process.env.IS_SESSION_ID;
const tlsInsecure = process.env.IS_TLS_INSECURE === "true";
const dataset = process.argv[2] ?? "mathes";

if (!baseUrl || !sessionId) {
  console.error("Set IS_BASE_URL and IS_SESSION_ID in .env");
  process.exit(1);
}

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

const paths = [
  "/internal/datasetSummaries/",
  `/internal/dataset/${dataset}/campaignSummaries/`,
  `/internal/dataset/${dataset}/campaigns/`,
  `/internal/dataset/${dataset}/campaignSummaries`,
  `/internal/campaignSummaries/?dataset=${dataset}`,
  `/internal/campaignSummaries?datasetId=${dataset}`,
  `/internal/dataset/${dataset}/segmentSummaries/`,
  `/internal/dataset/${dataset}/segments/`,
  `/internal/dataset/${dataset}/segmentSummaries`,
  `/internal/segmentSummaries/?dataset=${dataset}`,
  `/internal/dataset/${dataset}/templates/`,
  `/internal/dataset/${dataset}/templateSummaries/`,
  `/internal/dataset/${dataset}/contentZones/`,
  `/internal/dataset/${dataset}/rules/`,
  `/internal/dataset/${dataset}/experiences/`,
  `/internal/dataset/${dataset}/context/`,
  `/internal/context/?dataset=${dataset}`,
  `/internal/dataset/${dataset}/`,
  `/internal/datasets/${dataset}/campaigns/`,
  `/internal/datasets/${dataset}/segments/`,
  `/api/dataset/${dataset}/campaigns`,
  `/api/dataset/${dataset}/segments`,
];

async function main() {
  for (const path of paths) {
    try {
      const res = await client.get(path);
      const body =
        typeof res.data === "string"
          ? res.data.slice(0, 80)
          : JSON.stringify(res.data).slice(0, 120);
      console.log(`${res.status}\t${path}\t${body}`);
    } catch (err) {
      console.log(`ERR\t${path}\t${err instanceof Error ? err.message : err}`);
    }
  }
}

main();
