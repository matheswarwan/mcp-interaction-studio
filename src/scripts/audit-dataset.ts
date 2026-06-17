#!/usr/bin/env node
import "dotenv/config";
import * as path from "node:path";
import { loadConfig } from "../config.js";
import { buildDatasetAudit } from "../audit/buildAudit.js";
import { formatAuditMarkdown } from "../audit/formatAuditMarkdown.js";
import { resolveDataset } from "../utils/dataset.js";

function printUsage(): void {
  console.error(`Usage: audit-dataset <dataset> [options]

Options:
  --time-range <range>       Campaign/segment stats window (default: pastQuarter)
  --stats-year-range <range> Year comparison window (default: current calendar year)
  --format <markdown|json>   Output format (default: markdown)
  --output <path>            Write report to file (default: stdout only)

Examples:
  audit-dataset eharper
  audit-dataset eharper --output ../audit/eharper-audit.md
  audit-dataset mathes --format json --output /tmp/mathes-audit.json
`);
}

async function main(): Promise<void> {
  loadConfig();

  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  let datasetArg: string | undefined;
  let timeRange = "pastQuarter";
  let statsYearRange: string | undefined;
  let format: "markdown" | "json" = "markdown";
  let outputPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--time-range") {
      timeRange = args[++i] ?? timeRange;
    } else if (arg === "--stats-year-range") {
      statsYearRange = args[++i];
    } else if (arg === "--format") {
      const value = args[++i];
      if (value === "json" || value === "markdown") format = value;
    } else if (arg === "--output") {
      outputPath = args[++i];
    } else if (!arg.startsWith("-") && !datasetArg) {
      datasetArg = arg;
    }
  }

  if (!datasetArg) {
    printUsage();
    process.exit(1);
  }

  const dataset = resolveDataset(datasetArg);
  const audit = await buildDatasetAudit({
    dataset,
    timeRange,
    statsYearRange,
  });

  const content =
    format === "json" ? JSON.stringify(audit, null, 2) : formatAuditMarkdown(audit);

  if (outputPath) {
    const fs = await import("node:fs");
    const resolved = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content, "utf8");
    console.error(
      `Wrote ${format} audit for "${dataset}" (${audit.label}) → ${resolved}`
    );
    console.log(
      `Summary: ${audit.campaigns.length} campaigns, ${audit.segments.length} segments, ${audit.findings.length} finding(s)`
    );
  } else {
    console.log(content);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
