import { McpDatasetAudit } from "./buildMcpDatasetAudit.js";
import {
  ExecutiveNarrative,
  StrategicRecommendation,
  synthesizeExecutiveNarrative,
} from "./synthesizeExecutiveNarrative.js";

function stripMd(text: string): string {
  return text.replace(/\*\*/g, "");
}

function priorityLabel(p: StrategicRecommendation["priority"]): string {
  if (p === "immediate") return "Immediate (0–30 days)";
  if (p === "short_term") return "Short term (30–90 days)";
  return "Medium term (90+ days)";
}

function bulletList(items: string[]): string[] {
  if (items.length === 0) return ["_None identified._"];
  return items.map((item) => `- ${item}`);
}

export function buildExecutiveNarrative(audit: McpDatasetAudit): ExecutiveNarrative {
  return synthesizeExecutiveNarrative(audit);
}

export function formatExecutiveAuditMarkdown(audit: McpDatasetAudit): string {
  const narrative = synthesizeExecutiveNarrative(audit);
  const generated = audit.generatedAt.slice(0, 10);
  const published = audit.campaigns.filter((c) => c.state === "Published").length;

  const lines: string[] = [
    `# Salesforce Personalization Platform Assessment`,
    `## ${audit.label} (\`${audit.dataset}\`)`,
    "",
    `**Assessment date:** ${generated}  `,
    `**Instance:** ${audit.instanceUrl}  `,
    `**Prepared for:** Executive review  `,
    `**Overall health:** ${narrative.healthRating} (${narrative.healthScore}/100)`,
    "",
    "---",
    "",
    "## 1. Executive Summary",
    "",
    stripMd(narrative.executiveSummary),
    "",
    "### At a glance",
    "",
    "| Indicator | Value |",
    "|-----------|-------|",
    ...narrative.atAGlance.map((r) => `| ${r.label} | ${r.value} |`),
    "",
    "---",
    "",
    "## 2. Instance Overview",
    "",
    stripMd(narrative.instanceStory),
    "",
    "---",
    "",
    "## 3. Assessment Summary",
    "",
    "### What is working well",
    "",
    ...bulletList(narrative.workingWell.map(stripMd)),
    "",
    "### What needs attention",
    "",
    ...bulletList(narrative.needsAttention.map(stripMd)),
    "",
    "### Critical gaps and risks",
    "",
    ...(narrative.criticalGaps.length > 0
      ? bulletList(narrative.criticalGaps.map(stripMd))
      : ["_No critical gaps identified in this assessment cycle._"]),
    "",
    "---",
    "",
    "## 4. Strategic Recommendations",
    "",
    "| Priority | Recommendation | Rationale |",
    "|----------|----------------|-----------|",
    ...narrative.strategicRecommendations.map(
      (r) => `| ${priorityLabel(r.priority)} | ${r.title} | ${r.rationale} |`
    ),
    "",
    "---",
    "",
    "## 5. Domain Assessments",
    "",
  ];

  for (const domain of narrative.domainAssessments) {
    lines.push(
      `### ${domain.domain}`,
      "",
      `**Rating:** ${domain.rating}`,
      "",
      domain.summary,
      "",
      "**Strengths**",
      "",
      ...bulletList(domain.strengths),
      "",
      "**Concerns**",
      "",
      ...(domain.concerns.length ? bulletList(domain.concerns) : ["_None significant._"]),
      "",
      "**Recommendations**",
      "",
      ...bulletList(domain.recommendations),
      ""
    );
  }

  lines.push(
    "---",
    "",
    "## 6. Risk Register",
    "",
    "| Severity | Finding | Recommendation |",
    "|----------|---------|----------------|",
    ...narrative.prioritizedFindings.map(
      (f) => `| ${f.severity.toUpperCase()} | ${f.finding} | ${f.recommendation} |`
    ),
    "",
    "---",
    "",
    "## 7. Technical Appendix",
    "",
    "### Campaign portfolio (summary)",
    "",
    `| Published | Disabled | Total | Year impressions (${audit.statsYearRange}) |`,
    "|----------:|---------:|------:|---------------------------------------------:|",
    `| ${published} | ${audit.campaigns.length - published} | ${audit.campaigns.length} | ${audit.campaigns.reduce((s, c) => s + c.statsYear.impressions, 0)} |`,
    "",
    "### Published campaigns",
    "",
    ...audit.campaigns
      .filter((c) => c.state === "Published")
      .map((c) => `- **${c.name}** (\`${c.id}\`) — ${c.campaignType ?? "—"}`),
    "",
    "### Segment health",
    "",
    `| Segment | Members (end) | Calc status |`,
    "|---------|--------------:|-------------|",
    ...audit.segments.map(
      (s) =>
        `| ${s.name} | ${s.endMemberCount ?? "—"} | ${s.calcStatus ?? "—"} |`
    )
  );

  if (audit.governance) {
    lines.push(
      "",
      "### Governance (dataset access)",
      "",
      "| User | Role | Last login |",
      "|------|------|------------|",
      ...audit.governance.datasetUsers.map(
        (u) =>
          `| ${u.name} | ${u.roleIds.join(", ")} | ${u.lastLoginDate ? new Date(u.lastLoginDate).toISOString().slice(0, 10) : "—"} |`
      )
    );
  }

  if (audit.consumption) {
    const d = audit.consumption.dataset;
    lines.push(
      "",
      "### Consumption (12-month window)",
      "",
      `| MUV cap | ${audit.consumption.limits.muv ?? "—"} |`,
      `| Dataset MUV (total) | ${d.muvTotal} |`,
      `| Dataset events | ${d.events} |`,
      `| Event errors | ${d.eventErrors} |`
    );
  }

  lines.push(
    "",
    "---",
    "",
    "## Methodology",
    "",
    "This assessment was generated by `audit_mcp_dataset` using Salesforce Marketing Cloud Personalization",
    "admin APIs. It follows a structured review pattern: executive narrative, domain ratings, prioritized",
    "recommendations, and a technical appendix. Data reflects the point-in-time state of the platform;",
    "validate critical findings before contractual or investment decisions.",
    "",
    `*End of report — ${audit.label} (${audit.dataset})*`
  );

  return lines.join("\n");
}
