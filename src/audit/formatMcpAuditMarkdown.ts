import { McpDatasetAudit } from "./buildMcpDatasetAudit.js";
import { formatAuditMarkdown } from "./formatAuditMarkdown.js";

function formatDate(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toISOString().slice(0, 10);
}

function formatRange(start: number, end: number): string {
  return `${formatDate(start)} .. ${formatDate(end)}`;
}

export function formatMcpAuditMarkdown(audit: McpDatasetAudit): string {
  const base = formatAuditMarkdown(audit);
  const lines: string[] = [
    base.replace(
      "**Audit scope:** Dataset configuration, campaigns, segments, templates, recipes, surveys, content zones, and performance metrics",
      "**Audit scope:** Full MCP dataset audit — configuration, campaigns, segments, governance, consumption, and settings"
    ),
  ];

  lines.push("", "---", "", "## Orchestration Steps", "");
  lines.push("| Step | Status | Duration |");
  lines.push("|------|--------|----------|");
  for (const step of audit.steps) {
    const err = step.error ? ` — ${step.error}` : "";
    lines.push(`| ${step.step} | ${step.status}${err} | ${step.durationMs}ms |`);
  }

  if (audit.governance) {
    const g = audit.governance;
    lines.push(
      "",
      "---",
      "",
      "## Governance",
      "",
      "| Metric | Count |",
      "|--------|------:|",
      `| Total users | ${g.totalUsers} |`,
      `| Enabled users | ${g.enabledUsers} |`,
      `| Admin users | ${g.adminUsers} |`,
      `| Users without 2FA | ${g.usersWithout2fa} |`,
      `| Users with dataset access | ${g.datasetUserCount} |`,
      `| Role definitions | ${g.roles.length} |`,
      `| SFTP principals | ${g.sftpPrincipals.length} |`,
      "",
      "### Users with dataset access",
      "",
      "| Name | Email | Roles | Last login |",
      "|------|-------|-------|------------|"
    );
    for (const user of g.datasetUsers) {
      lines.push(
        `| ${user.name} | ${user.email ?? "—"} | ${user.roleIds.join(", ")} | ${user.lastLoginDate ? formatDate(user.lastLoginDate) : "—"} |`
      );
    }

    const datasetSftp = g.sftpPrincipals.filter((p) => p.sftpDataset === audit.dataset);
    if (datasetSftp.length > 0) {
      lines.push("", "### SFTP principals (this dataset)", "");
      for (const p of datasetSftp) {
        lines.push(`- ${p.description ?? p.principalId} (${p.enabled ? "enabled" : "disabled"})`);
      }
    }
  }

  if (audit.consumption) {
    const c = audit.consumption;
    const d = c.dataset;
    lines.push(
      "",
      "---",
      "",
      "## Consumption",
      "",
      `**Window:** ${formatRange(c.range.start, c.range.end)}`,
      "",
      "### Account limits",
      "",
      "| Limit | Value |",
      "|-------|------:|",
      `| MUV cap | ${c.limits.muv ?? "—"} |`,
      `| NIP cap | ${c.limits.nip ?? "—"} |`,
      "",
      `### Dataset \`${audit.dataset}\` usage`,
      "",
      "| Metric | Total (window) | Latest month |",
      "|--------|---------------:|-------------:|",
      `| MUV | ${d.muvTotal} | ${d.muvLatestMonth} |`,
      `| NIP (named identified profiles) | ${d.nipTotal} | ${d.nipLatestMonth} |`,
      `| Events | ${d.events} | — |`,
      `| Event errors | ${d.eventErrors} | — |`,
      `| Segment exports | ${d.segmentExports} | — |`,
      `| Campaign stats | ${d.campaignStats} | — |`,
      `| ETL user exports | ${d.etlUserExports} | — |`,
      `| Triggered campaigns | ${d.triggeredCampaigns} | — |`,
      "",
      `Account MUV total (all datasets, window): **${c.accountMuvTotal}**`
    );
  }

  if (audit.datasetSettings) {
    const s = audit.datasetSettings;
    const setup = s.integrationSetup;
    lines.push(
      "",
      "---",
      "",
      "## Dataset Settings",
      "",
      "| Setting | Value |",
      "|---------|-------|",
      `| Dataset type | ${setup.datasetType ?? "—"} |`,
      `| Track accounts | ${setup.trackAccounts === true ? "Yes" : "No"} |`,
      `| Track anonymous visitors | ${setup.trackAnonymousVisitors === true ? "Yes" : "No"} |`,
      `| C360A integration | ${setup.c360aIntegrationEnabled === true ? "Yes" : "No"} |`,
      `| Locale | ${s.catalogConfigSummary.locale ?? "—"} |`,
      `| Currency | ${s.catalogConfigSummary.currency ?? "—"} |`,
      `| Catalog item types | ${s.catalogConfigSummary.itemTypes.join(", ") || "—"} |`,
      `| PII user attributes | ${s.piiAttributeCount} |`,
      `| Identity types (account) | ${s.identityTypes.length} |`,
      `| User attributes (dataset) | ${s.userAttributes.length} |`
    );

    if (s.userAttributes.length > 0) {
      lines.push("", "### User attributes", "", "| Name | Type | Classification |", "|------|------|----------------|");
      for (const attr of s.userAttributes) {
        lines.push(
          `| ${attr.label ?? attr.name} | ${attr.type ?? "—"} | ${attr.overrideClassification ?? "—"} |`
        );
      }
    }
  }

  if (audit.extendedFindings.length > 0) {
    lines.push("", "---", "", "## Extended Findings", "");
    lines.push("| Severity | Finding | Recommendation |");
    lines.push("|----------|---------|----------------|");
    for (const f of audit.extendedFindings) {
      lines.push(`| ${f.severity} | ${f.finding} | ${f.recommendation} |`);
    }
  }

  lines.push(
    "",
    "---",
    "",
    "## Data Collection Methodology",
    "",
    "Generated by `audit_mcp_dataset` via Interaction Studio internal admin APIs (`/internal/*`).",
    "Sections: dataset audit, governance (`/internal/principals/`, `/internal/roleDefinitions/`),",
    "consumption (`/internal/consumption/*`), settings (`integrationSetup`, `catalogConfig`).",
    "",
    "*End of MCP dataset audit report.*"
  );

  return lines.join("\n");
}
