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

const client = axios.create({
  baseURL: baseUrl,
  httpsAgent: new https.Agent({ rejectUnauthorized: env.IS_TLS_INSECURE !== "true" }),
  headers: { Cookie: `JSESSIONID=${sessionId}` },
  validateStatus: () => true,
});

async function main() {
  const html = await client.get("/ui/");
  const srcs = [...String(html.data).matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1]);
  console.log("js files:", srcs.length);

  const hits: string[] = [];
  for (const src of srcs.slice(0, 30)) {
    const url = src.startsWith("http") ? src : `/ui/${src.replace(/^\//, "")}`;
    const js = await client.get(url);
    const text = String(js.data);
    if (text.includes("timeRange") || text.includes("campaignSummaries") || text.includes("segmentSummaries")) {
      hits.push(url);
      const timeRangeMatches = [...text.matchAll(/timeRange[^"'`\s]{0,40}/g)].slice(0, 5);
      console.log("\n", url, "status", js.status);
      for (const m of timeRangeMatches) console.log(" ", m[0]);
      const enums = [...text.matchAll(/"(Today|Yesterday|Last[^"]+|AllTime)"/g)].slice(0, 20);
      console.log(" enums:", [...new Set(enums.map((m) => m[1]))].join(", "));
    }
  }
  console.log("\nHit files:", hits);
}

main();
