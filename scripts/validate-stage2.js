#!/usr/bin/env node
/**
 * Stage 2 validation: exercises audit_dataset, compare_datasets,
 * get_recipe_usage, list_segment_stats, and CLI audit script.
 */
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../dist/config.js";
import { fetchDatasetSummaries } from "../dist/api/datasets.js";
import { buildDatasetAudit } from "../dist/audit/buildAudit.js";
import { formatAuditMarkdown } from "../dist/audit/formatAuditMarkdown.js";
import { handleCompareDatasets } from "../dist/tools/compare_datasets.js";
import { handleGetRecipeUsage } from "../dist/tools/get_recipe_usage.js";
import { handleListSegmentStats } from "../dist/tools/list_segment_stats.js";
import { fetchCampaignSummaries } from "../dist/api/campaigns.js";
import { fetchCampaignStats, aggregateStats } from "../dist/api/campaignStats.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(__dirname, "../..");
const AUDIT_DIR = path.join(WORKSPACE, "audit");
const STATS_YEAR = "2026-01-01..2026-12-31";
const TIME_RANGE = "pastQuarter";
const PRIORITY = ["eharper", "mathes", "mcpdemo", "nto", "engage"];
const JSON_EXPORTS = ["eharper", "mathes", "mcpdemo"];
const DEMO_HEALTH = ["mcpdemo", "mathes"];
const COMPARE_PAIRS = [
  ["eharper", "mathes"],
  ["eharper", "mcpdemo"],
];

loadConfig();

function isAuthError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return /401|403|permission|Bad Credentials|Session expired/i.test(msg);
}

function sumYearImpressions(campaigns) {
  return campaigns.reduce((s, c) => s + (c.statsYear?.impressions ?? 0), 0);
}

function severityCounts(findings) {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  }
  return counts;
}

async function auditDataset(dataset, { format = "markdown", outputPath } = {}) {
  const audit = await buildDatasetAudit({
    dataset,
    timeRange: TIME_RANGE,
    statsYearRange: STATS_YEAR,
  });
  const content =
    format === "json" ? JSON.stringify(audit, null, 2) : formatAuditMarkdown(audit);
  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content, "utf8");
  }
  return audit;
}

function printTable(headers, rows) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length))
  );
  const sep = widths.map((w) => "-".repeat(w)).join("-+-");
  const fmt = (row) => row.map((c, i) => String(c ?? "").padEnd(widths[i])).join(" | ");
  console.log(fmt(headers));
  console.log(sep);
  for (const row of rows) console.log(fmt(row));
}

async function rankDatasetsByImpressions(datasets) {
  const rank = [];
  for (const ds of datasets) {
    try {
      const campaigns = await fetchCampaignSummaries(ds, STATS_YEAR);
      let total = 0;
      for (const c of campaigns) {
        const id = c.campaignId ?? c.id;
        if (!id) continue;
        try {
          const stats = await fetchCampaignStats(ds, id, STATS_YEAR);
          total += aggregateStats(stats.totalStats?.bucketedStats).impressions ?? 0;
        } catch {
          /* skip individual campaign stat failures */
        }
      }
      rank.push({ dataset: ds, totalImpressions: total, campaignCount: campaigns.length });
    } catch (err) {
      if (isAuthError(err)) {
        rank.push({ dataset: ds, totalImpressions: -1, campaignCount: 0, skipped: true });
      } else {
        rank.push({ dataset: ds, totalImpressions: 0, campaignCount: 0, error: err.message });
      }
    }
  }
  return rank.sort((a, b) => b.totalImpressions - a.totalImpressions);
}

async function main() {
  const results = {
    sessionOk: false,
    datasets: [],
    sweep: [],
    skipped: [],
    priority: [],
    jsonExports: [],
    comparisons: [],
    demoHealth: [],
    impressionsRank: [],
    baseline: null,
    errors: [],
  };

  console.log("=== Stage 2 Validation ===\n");

  // 1. Session + list datasets
  let summaries;
  try {
    summaries = await fetchDatasetSummaries();
    results.sessionOk = true;
    results.datasets = summaries.map((d) => d.name ?? d.dataset ?? d.id).filter(Boolean);
    console.log(
      `✓ Session OK — ${results.datasets.length} dataset(s): ${results.datasets.join(", ")}\n`
    );
  } catch (err) {
    console.error("✗ Session failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  fs.mkdirSync(AUDIT_DIR, { recursive: true });

  // 2. Full audit sweep
  console.log("--- Full audit sweep ---");
  for (const ds of results.datasets) {
    try {
      const out = path.join(AUDIT_DIR, `${ds}-audit.md`);
      const audit = await auditDataset(ds, { outputPath: out });
      const row = {
        dataset: ds,
        campaigns: audit.campaigns.length,
        segments: audit.segments.length,
        findings: audit.findings.length,
        yearImpressions: sumYearImpressions(audit.campaigns),
        status: "ok",
      };
      results.sweep.push(row);
      console.log(
        `  ✓ ${ds}: ${row.campaigns} campaigns, ${row.segments} segments, ${row.findings} findings, ${row.yearImpressions} yr impressions → ${out}`
      );
    } catch (err) {
      if (isAuthError(err)) {
        results.skipped.push({ dataset: ds, reason: err.message });
        console.log(`  ⊘ ${ds}: skipped (auth/permission)`);
      } else {
        results.errors.push({ dataset: ds, step: "sweep", error: err.message });
        console.log(`  ✗ ${ds}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  console.log();

  // 3. Priority datasets (re-run to log explicitly)
  console.log("--- Priority datasets ---");
  for (const ds of PRIORITY) {
    if (!results.datasets.includes(ds)) {
      console.log(`  ⊘ ${ds}: not in account`);
      continue;
    }
    try {
      const out = path.join(AUDIT_DIR, `${ds}-audit.md`);
      const audit = await auditDataset(ds, { outputPath: out });
      const row = {
        dataset: ds,
        campaigns: audit.campaigns.length,
        segments: audit.segments.length,
        findings: audit.findings.length,
        yearImpressions: sumYearImpressions(audit.campaigns),
      };
      results.priority.push(row);
      console.log(
        `  ✓ ${ds}: campaigns=${row.campaigns} segments=${row.segments} findings=${row.findings} impressions=${row.yearImpressions}`
      );
    } catch (err) {
      console.log(`  ✗ ${ds}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log();

  // 4. JSON exports + severity comparison
  console.log("--- JSON exports ---");
  const severityRows = [];
  for (const ds of JSON_EXPORTS) {
    if (!results.datasets.includes(ds)) continue;
    try {
      const out = path.join(AUDIT_DIR, `${ds}-audit.json`);
      const audit = await auditDataset(ds, { format: "json", outputPath: out });
      const sev = severityCounts(audit.findings);
      results.jsonExports.push({ dataset: ds, path: out, ...sev, total: audit.findings.length });
      severityRows.push([ds, sev.high, sev.medium, sev.low, audit.findings.length]);
      console.log(`  ✓ ${ds} → ${out}`);
    } catch (err) {
      console.log(`  ✗ ${ds}: ${err instanceof Error ? err.message : err}`);
    }
  }
  if (severityRows.length > 0) {
    console.log("\nFindings severity comparison:");
    printTable(["Dataset", "High", "Medium", "Low", "Total"], severityRows);
  }
  console.log();

  // 5. Baseline JSON for eharper
  console.log("--- eharper baseline ---");
  if (results.datasets.includes("eharper")) {
    try {
      const baselinePath = path.join(AUDIT_DIR, "eharper-baseline-2026-06-17.json");
      const audit = await auditDataset("eharper", { format: "json", outputPath: baselinePath });
      results.baseline = {
        path: baselinePath,
        campaigns: audit.campaigns.length,
        segments: audit.segments.length,
        findings: audit.findings.length,
        yearImpressions: sumYearImpressions(audit.campaigns),
        disabledCampaigns: audit.campaigns.filter((c) => c.state === "Disabled").length,
      };
      console.log(`  ✓ Baseline saved → ${baselinePath}`);
      console.log(
        `  Compare next time: campaigns=${results.baseline.campaigns} segments=${results.baseline.segments} findings=${results.baseline.findings} yearImpressions=${results.baseline.yearImpressions} disabled=${results.baseline.disabledCampaigns}`
      );
    } catch (err) {
      console.log(`  ✗ baseline: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log();

  // 6. Pairwise comparisons
  console.log("--- Pairwise compare ---");
  for (const [a, b] of COMPARE_PAIRS) {
    if (!results.datasets.includes(a) || !results.datasets.includes(b)) {
      console.log(`  ⊘ ${a} vs ${b}: dataset missing`);
      continue;
    }
    try {
      const text = await handleCompareDatasets({
        dataset_a: a,
        dataset_b: b,
        time_range: TIME_RANGE,
      });
      results.comparisons.push({ a, b, text });
      console.log(`\n${text}\n`);
    } catch (err) {
      console.log(`  ✗ ${a} vs ${b}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // 7. Demo health check
  console.log("--- Demo health check ---");
  for (const ds of DEMO_HEALTH) {
    if (!results.datasets.includes(ds)) continue;
    try {
      const recipeRaw = await handleGetRecipeUsage({
        dataset: ds,
        time_range: TIME_RANGE,
        include_raw: true,
      });
      const recipeReport = JSON.parse(recipeRaw);
      const unlinked = recipeReport.unlinkedRecipeIds?.length ?? 0;
      const staleInUse = (recipeReport.recipes ?? []).filter(
        (r) => !r.inUseFlag && r.campaigns?.length > 0
      ).length;

      const segRaw = await handleListSegmentStats({
        dataset: ds,
        time_range: TIME_RANGE,
        include_raw: true,
      });
      const segStats = JSON.parse(segRaw);
      const zeroEnd = segStats.filter((s) => s.endMemberCount === 0).length;
      const notComplete = segStats.filter(
        (s) => (s.mostRecentNightlyCalcStatus ?? s.currentStatus) !== "COMPLETE"
      ).length;

      const healthy =
        unlinked === 0 && staleInUse === 0 && zeroEnd < segStats.length / 2 && notComplete === 0;
      const row = { dataset: ds, unlinked, staleInUse, zeroEnd, notComplete, healthy };
      results.demoHealth.push(row);
      console.log(
        `  ${healthy ? "✓" : "⚠"} ${ds}: unlinked=${unlinked} staleInUse=${staleInUse} zeroEndSegments=${zeroEnd} notComplete=${notComplete} → ${healthy ? "healthy for demos" : "needs cleanup"}`
      );
    } catch (err) {
      console.log(`  ✗ ${ds}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log();

  // 8. Busiest datasets by 2026 impressions
  console.log("--- Impressions rank (2026) ---");
  results.impressionsRank = await rankDatasetsByImpressions(results.datasets);
  const rankRows = results.impressionsRank
    .filter((r) => !r.skipped)
    .slice(0, 10)
    .map((r, i) => [i + 1, r.dataset, r.campaignCount, r.totalImpressions]);
  if (rankRows.length > 0) {
    printTable(["Rank", "Dataset", "Campaigns", "2026 Impressions"], rankRows);
  }
  console.log();

  // 9. Executive rollup
  console.log("--- Executive rollup ---");
  const mdFiles = fs.readdirSync(AUDIT_DIR).filter((f) => f.endsWith("-audit.md"));
  let totalCampaigns = 0;
  let totalSegments = 0;
  let zeroImpressionDatasets = [];
  let unlinkedRecipeDatasets = [];
  const allFindings = [];

  for (const file of mdFiles) {
    const content = fs.readFileSync(path.join(AUDIT_DIR, file), "utf8");
    const ds = file.replace("-audit.md", "");
    const campMatch = content.match(/\| Campaigns \| (\d+)/);
    const segMatch = content.match(/\| Segments \| (\d+)/);
    if (campMatch) totalCampaigns += parseInt(campMatch[1], 10);
    if (segMatch) totalSegments += parseInt(segMatch[1], 10);
    if (/No campaign impressions recorded/.test(content)) zeroImpressionDatasets.push(ds);
    if (/not linked to any campaign/.test(content)) unlinkedRecipeDatasets.push(ds);
    const findingBlocks = content.match(/- \[(HIGH|MEDIUM|LOW)\][^\n]*/g) ?? [];
    for (const block of findingBlocks) {
      const sev = block.match(/\[(HIGH|MEDIUM|LOW)\]/)?.[1]?.toLowerCase() ?? "low";
      allFindings.push({ dataset: ds, severity: sev, text: block });
    }
  }

  const topRecs = allFindings
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    })
    .slice(0, 5);

  const rollupPath = path.join(AUDIT_DIR, "executive-summary.md");
  const rollup = [
    "# Interaction Studio Audit — Executive Summary",
    "",
    `**Generated:** ${new Date().toISOString().slice(0, 10)}`,
    `**Datasets audited:** ${mdFiles.length}`,
    "",
    "## Totals",
    "",
    `| Metric | Count |`,
    `|--------|------:|`,
    `| Total campaigns | ${totalCampaigns} |`,
    `| Total segments | ${totalSegments} |`,
    "",
    "## Datasets with zero year impressions",
    "",
    zeroImpressionDatasets.length
      ? zeroImpressionDatasets.map((d) => `- \`${d}\``).join("\n")
      : "_None_",
    "",
    "## Datasets with unlinked recipes",
    "",
    unlinkedRecipeDatasets.length
      ? unlinkedRecipeDatasets.map((d) => `- \`${d}\``).join("\n")
      : "_None_",
    "",
    "## Top 5 recommendations (all datasets)",
    "",
    ...topRecs.map((f, i) => `${i + 1}. **${f.dataset}** [${f.severity.toUpperCase()}]: ${f.text.replace(/^- \[(HIGH|MEDIUM|LOW)\] /, "")}`),
    "",
    "## Sweep summary",
    "",
    "| Dataset | Campaigns | Segments | Findings | Year Impressions | Status |",
    "|---------|----------:|---------:|---------:|-----------------:|--------|",
    ...results.sweep.map(
      (r) =>
        `| ${r.dataset} | ${r.campaigns} | ${r.segments} | ${r.findings} | ${r.yearImpressions} | ${r.status} |`
    ),
    ...(results.skipped.length
      ? [
          "",
          "**Skipped (auth/permission):** " + results.skipped.map((s) => s.dataset).join(", "),
        ]
      : []),
  ].join("\n");

  fs.writeFileSync(rollupPath, rollup, "utf8");
  console.log(`  ✓ Executive summary → ${rollupPath}`);
  console.log();

  // Final summary table
  console.log("=== Stage 2 Validation Complete ===\n");
  if (results.sweep.length > 0) {
    printTable(
      ["Dataset", "Campaigns", "Segments", "Findings", "Yr Impressions", "Status"],
      results.sweep.map((r) => [
        r.dataset,
        r.campaigns,
        r.segments,
        r.findings,
        r.yearImpressions,
        r.status,
      ])
    );
  }
  if (results.skipped.length > 0) {
    console.log(`\nSkipped: ${results.skipped.map((s) => s.dataset).join(", ")}`);
  }
  if (results.errors.length > 0) {
    console.log(`\nErrors: ${results.errors.length}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
