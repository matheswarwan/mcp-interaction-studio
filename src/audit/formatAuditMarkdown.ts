import { DatasetAudit, AuditCampaignEntry } from "./buildAudit.js";
import { RecipeUsageReport } from "../utils/recipeUsage.js";

function formatDate(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toISOString().slice(0, 10);
}

function formatStatsRow(label: string, stats: {
  impressions: number;
  clickthroughs: number;
  uniqueUsers: number;
  goalAchievements: number;
  orders: number;
  revenue: number;
}): string {
  return `| ${label} | ${stats.impressions} | ${stats.clickthroughs} | ${stats.uniqueUsers} | ${stats.goalAchievements} | ${stats.orders} | $${stats.revenue} |`;
}

export function formatAuditMarkdown(audit: DatasetAudit): string {
  const published = audit.campaigns.filter((c) => c.state === "Published").length;
  const disabled = audit.campaigns.filter((c) => c.state === "Disabled").length;

  const lines: string[] = [
    `# Interaction Studio Dataset Audit: ${audit.label} (\`${audit.dataset}\`)`,
    "",
    `**Generated:** ${audit.generatedAt.slice(0, 10)}`,
    `**Instance:** ${audit.instanceUrl}`,
    `**Audit scope:** Dataset configuration, campaigns, segments, templates, recipes, surveys, content zones, and performance metrics`,
    "",
    "---",
    "",
    "## Executive Summary",
    "",
    "| Metric | Count |",
    "|--------|------:|",
    `| Campaigns | ${audit.campaigns.length} |`,
    `| Published campaigns | ${published} |`,
    `| Disabled campaigns | ${disabled} |`,
    `| Segments | ${audit.segments.length} |`,
    `| Item templates | ${audit.templateCount} |`,
    `| Recipes | ${audit.recipeUsage.recipes.length} |`,
    `| Surveys | ${audit.surveyCount} |`,
    `| Content zones | ${audit.contentZones.length} |`,
    "",
  ];

  if (audit.findings.length > 0) {
    lines.push("**Key findings:**");
    audit.findings.forEach((f) => {
      lines.push(`- [${f.severity.toUpperCase()}] ${f.finding}`);
    });
    lines.push("");
  }

  lines.push(
    "---",
    "",
    "## 1. Dataset Configuration",
    "",
    "| Setting | Value |",
    "|---------|-------|",
    `| **Display name** | ${audit.label} |`,
    `| **Dataset ID** | \`${audit.dataset}\` |`,
    `| **State** | ${audit.datasetDetail.state ?? "—"} |`,
    `| **Track accounts** | ${audit.datasetDetail.trackAccounts ? "Yes" : "No"} |`,
    `| **Track anonymous users** | ${audit.datasetDetail.trackAnonymousUsers ? "Yes" : "No"} |`,
    `| **Beacon disabled** | ${audit.datasetDetail.beaconDisabled ? "Yes" : "No"} |`,
    `| **Last modified** | ${audit.datasetDetail.modified ? new Date(audit.datasetDetail.modified).toISOString() : "—"} |`,
    "",
    "### Content Zones",
    "",
    audit.contentZones.length > 0
      ? audit.contentZones.map((z) => `- ${z}`).join("\n")
      : "_None configured_",
    "",
    "---",
    "",
    "## 2. Campaign Inventory",
    "",
    "| ID | Name | State | Type | Priority | Modified | Zones | Recipes |",
    "|----|------|-------|------|----------|----------|-------|---------|"
  );

  for (const c of audit.campaigns) {
    lines.push(
      `| \`${c.id}\` | ${c.name} | ${c.state ?? "—"} | ${c.campaignType ?? "—"} | ${c.priority ?? 0} | ${formatDate(c.modified ?? c.updated)} | ${c.insights.contentZones.join(", ") || "—"} | ${c.insights.recipeIds.join(", ") || "—"} |`
    );
  }

  lines.push(
    "",
    "### Campaign Details",
    ""
  );

  for (const c of audit.campaigns) {
    lines.push(`#### \`${c.id}\` — ${c.name} (${c.state ?? "—"})`);
    lines.push(
      `- **Type:** ${c.campaignType ?? "—"} | **Medium:** ${c.medium ?? "—"}`,
      `- **Goal:** ${c.insights.goal ?? "—"}`,
      `- **Folder:** ${c.insights.folderName ?? "—"}`
    );
    if (c.insights.rules.length > 0) {
      lines.push(`- **Rules:** ${c.insights.rules.map((r: AuditCampaignEntry["insights"]["rules"][number]) => r.abbreviatedDescription ?? r.description ?? r.id).join("; ")}`);
    }
    if (c.insights.controlUserPercentage !== undefined) {
      lines.push(`- **Control group:** ${c.insights.controlUserPercentage}%`);
    }
    if (c.insights.experiences.length > 0) {
      lines.push(`- **Experiences:** ${c.insights.experiences.map((e: AuditCampaignEntry["insights"]["experiences"][number]) => `${e.name} (${e.id})`).join(", ")}`);
    }
    lines.push("");
  }

  lines.push(
    "---",
    "",
    "## 3. Campaign Performance",
    "",
    `### ${audit.timeRange} (rolling)`,
    "",
    "| Campaign | Impressions | Clicks | Users | Goals | Orders | Revenue |",
    "|----------|------------:|-------:|------:|------:|-------:|--------:|"
  );

  for (const c of audit.campaigns) {
    lines.push(formatStatsRow(c.name, c.statsQuarter));
  }

  lines.push(
    "",
    `### ${audit.statsYearRange}`,
    "",
    "| Campaign | Impressions | Clicks | Users | Goals | Orders | Revenue |",
    "|----------|------------:|-------:|------:|------:|-------:|--------:|"
  );

  for (const c of audit.campaigns) {
    lines.push(formatStatsRow(c.name, c.statsYear));
  }

  lines.push(
    "",
    "---",
    "",
    "## 4. Segment Inventory",
    "",
    "| ID | Segment | Folder | Members (start→end) | Enabled | Calc status |",
    "|----|---------|--------|---------------------|---------|-------------|"
  );

  for (const s of audit.segments) {
    const members =
      s.startMemberCount !== undefined || s.endMemberCount !== undefined
        ? `${s.startMemberCount ?? "—"}→${s.endMemberCount ?? "—"}`
        : s.memberCount !== undefined
          ? String(s.memberCount)
          : "—";
    lines.push(
      `| \`${s.id}\` | ${s.name} | ${s.folder ?? "—"} | ${members} | ${s.enabled === undefined ? "—" : s.enabled ? "yes" : "no"} | ${s.calcStatus ?? "—"} |`
    );
  }

  lines.push(
    "",
    "---",
    "",
    "## 5. Item Templates",
    "",
    "| ID | Name | State | Item Type |",
    "|----|------|-------|-----------|"
  );

  for (const t of audit.templates) {
    lines.push(`| \`${t.id}\` | ${t.name} | ${t.state ?? "—"} | ${t.itemType ?? "—"} |`);
  }

  lines.push(
    "",
    "---",
    "",
    "## 6. Recipe Usage",
    "",
    "| Recipe | ID | API inUse | Linked Campaigns |",
    "|--------|----|-----------|------------------|"
  );

  for (const r of audit.recipeUsage.recipes) {
    const linked =
      r.campaigns.length > 0
        ? r.campaigns.map((c: RecipeUsageReport["recipes"][number]["campaigns"][number]) => `${c.name} (${c.id})`).join("; ")
        : "—";
    lines.push(
      `| ${r.recipeName} | \`${r.recipeId}\` | ${r.inUseFlag ? "yes" : "no"} | ${linked} |`
    );
  }

  lines.push(
    "",
    "---",
    "",
    "## 7. Surveys",
    "",
    audit.surveyCount === 0
      ? "No surveys configured in this dataset."
      : `${audit.surveyCount} survey(s) configured.`,
    "",
    "---",
    "",
    "## 8. Content Zone Activity",
    "",
    `**Time range:** ${audit.timeRange}`,
    "",
    audit.contentZoneLogCount > 0
      ? `${audit.contentZoneLogCount} content zone log entries in the selected window.`
      : "No content zone log activity in the selected window.",
    "",
    "---",
    "",
    "## 9. Findings & Recommendations",
    ""
  );

  if (audit.findings.length === 0) {
    lines.push("_No automated findings._");
  } else {
    lines.push("| Severity | Finding | Recommendation |", "|----------|---------|----------------|");
    for (const f of audit.findings) {
      lines.push(`| ${f.severity} | ${f.finding} | ${f.recommendation} |`);
    }
  }

  lines.push(
    "",
    "---",
    "",
    "## 10. Data Collection Methodology",
    "",
    "Generated by `mcp-interaction-studio` `audit_dataset` via Interaction Studio internal admin APIs (`/internal/*`).",
    "",
    "*End of audit report.*"
  );

  return lines.join("\n");
}
