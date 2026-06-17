import { AuditFinding } from "./buildAudit.js";
import { McpDatasetAudit } from "./buildMcpDatasetAudit.js";

export type HealthRating = "Strong" | "Adequate" | "Needs Attention" | "At Risk";
export type DomainRating = HealthRating;

export interface StrategicRecommendation {
  priority: "immediate" | "short_term" | "medium_term";
  title: string;
  rationale: string;
}

export interface DomainAssessment {
  domain: string;
  rating: DomainRating;
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendations: string[];
}

export interface ExecutiveNarrative {
  healthScore: number;
  healthRating: HealthRating;
  executiveSummary: string;
  instanceStory: string;
  workingWell: string[];
  needsAttention: string[];
  criticalGaps: string[];
  strategicRecommendations: StrategicRecommendation[];
  domainAssessments: DomainAssessment[];
  atAGlance: Array<{ label: string; value: string }>;
  prioritizedFindings: AuditFinding[];
}

function countBySeverity(findings: AuditFinding[]) {
  return {
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
  };
}

function ratingFromScore(score: number): HealthRating {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Adequate";
  if (score >= 50) return "Needs Attention";
  return "At Risk";
}

function domainRating(findings: AuditFinding[], strengthCount: number): DomainRating {
  if (findings.some((f) => f.severity === "high")) return "At Risk";
  if (findings.filter((f) => f.severity === "medium").length >= 2) return "Needs Attention";
  if (findings.length > 0 || strengthCount === 0) return "Adequate";
  return "Strong";
}

export function synthesizeExecutiveNarrative(audit: McpDatasetAudit): ExecutiveNarrative {
  const published = audit.campaigns.filter((c) => c.state === "Published");
  const disabled = audit.campaigns.filter((c) => c.state === "Disabled");
  const yearImpressions = audit.campaigns.reduce(
    (s, c) => s + (c.statsYear?.impressions ?? 0),
    0
  );
  const segmentsHealthy = audit.segments.filter((s) => s.calcStatus === "COMPLETE").length;
  const testCampaigns = audit.campaigns.filter((c) => /^(test|demo)/i.test(c.name.trim()));

  let healthScore = 100;
  for (const f of audit.findings) {
    if (f.severity === "high") healthScore -= 18;
    else if (f.severity === "medium") healthScore -= 9;
    else healthScore -= 4;
  }
  if (published.length > 0) healthScore += 3;
  if (yearImpressions > 0) healthScore += 5;
  if (audit.datasetDetail.beaconDisabled) healthScore -= 10;
  if (audit.consumption?.limits.muv) {
    const pct =
      (audit.consumption.dataset.muvLatestMonth / audit.consumption.limits.muv) * 100;
    if (pct < 5) healthScore += 2;
    if (pct > 80) healthScore -= 12;
  }
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  const workingWell: string[] = [];
  const needsAttention: string[] = [];
  const criticalGaps: string[] = [];
  const strategicRecommendations: StrategicRecommendation[] = [];

  if (audit.datasetDetail.state === "Online") {
    workingWell.push(
      `The **${audit.label}** dataset is online and actively configured with ${audit.contentZones.length} content zones for personalization delivery.`
    );
  }
  if (published.length > 0) {
    workingWell.push(
      `${published.length} of ${audit.campaigns.length} campaigns are published across web, email, and server-side channels — indicating an operational personalization program.`
    );
  }
  if (segmentsHealthy === audit.segments.length && audit.segments.length > 0) {
    workingWell.push(
      `All ${audit.segments.length} audience segments show healthy calculation status, supporting reliable targeting.`
    );
  }
  if (audit.consumption && audit.consumption.limits.muv) {
    const headroom =
      audit.consumption.limits.muv - audit.consumption.dataset.muvLatestMonth;
    if (headroom > 0 && audit.consumption.dataset.muvLatestMonth < audit.consumption.limits.muv * 0.1) {
      workingWell.push(
        `Platform consumption is well within contract limits (MUV cap ${audit.consumption.limits.muv.toLocaleString()}; dataset usage is minimal), leaving ample headroom for growth.`
      );
    }
  }
  if (audit.consumption?.dataset.eventErrors === 0 && (audit.consumption?.dataset.events ?? 0) > 0) {
    workingWell.push(
      "Event ingestion shows zero recorded errors in the consumption window — data quality appears stable."
    );
  }
  if (!audit.datasetDetail.beaconDisabled) {
    workingWell.push(
      "Visitor beacon tracking is enabled, which is foundational for web personalization measurement."
    );
  }
  if (audit.recipeUsage.recipes.some((r) => r.campaigns.length > 0)) {
    workingWell.push(
      "Recommendation recipes are linked to live campaigns, connecting machine-learning assets to customer-facing experiences."
    );
  }

  if (disabled.length > 0) {
    needsAttention.push(
      `${disabled.length} disabled campaign(s) remain in the dataset (${disabled.map((c) => c.name).join(", ")}). These add configuration noise and should be archived or reactivated with intent.`
    );
    strategicRecommendations.push({
      priority: "short_term",
      title: "Rationalize disabled campaigns",
      rationale:
        "Remove or document disabled campaigns to reduce operational confusion and simplify governance reviews.",
    });
  }
  if (testCampaigns.length > 0) {
    needsAttention.push(
      `${testCampaigns.length} test or demo campaign(s) detected. Shared production-adjacent datasets should not retain experimental artifacts without clear ownership.`
    );
  }
  if (audit.governance && audit.governance.usersWithout2fa > 0) {
    needsAttention.push(
      `All ${audit.governance.enabledUsers} enabled users hold admin-level access, and none have two-factor authentication enabled — a common gap in maturing Salesforce Personalization estates.`
    );
    strategicRecommendations.push({
      priority: "immediate",
      title: "Enforce two-factor authentication for administrators",
      rationale:
        "Admin accounts control campaigns, segments, and data exports. 2FA materially reduces account takeover risk.",
    });
  }
  if (audit.datasetSettings?.integrationSetup.datasetType === "Development") {
    needsAttention.push(
      "This dataset is classified as **Development**. Confirm that executive stakeholders understand whether reported metrics reflect production or sandbox traffic."
    );
  }
  const staleLogins = audit.governance?.datasetUsers.filter((u) => {
    if (!u.lastLoginDate) return true;
    return Date.now() - u.lastLoginDate > 365 * 24 * 60 * 60 * 1000;
  });
  if (staleLogins && staleLogins.length > 0) {
    needsAttention.push(
      `${staleLogins.length} user(s) with dataset access have not logged in within the past year. Review whether access remains justified.`
    );
    strategicRecommendations.push({
      priority: "short_term",
      title: "Conduct access review for inactive administrators",
      rationale: "Principle of least privilege — remove or downgrade dormant accounts.",
    });
  }
  if (audit.datasetSettings && audit.datasetSettings.piiAttributeCount > 0) {
    needsAttention.push(
      `${audit.datasetSettings.piiAttributeCount} user attributes are classified as personally identifiable information (PII). Ensure privacy policies and Data Cloud / MC sync agreements cover these fields.`
    );
  }

  if (yearImpressions === 0) {
    criticalGaps.push(
      `No campaign impressions were recorded in the ${audit.statsYearRange} reporting window despite ${published.length} published campaign(s). This suggests a breakdown in measurement, tagging, or live traffic — not merely low engagement.`
    );
    strategicRecommendations.push({
      priority: "immediate",
      title: "Diagnose zero-impression reporting",
      rationale:
        "Validate beacon deployment, dataset tagging on production properties, campaign targeting rules, and content zone mapping before investing in new experiences.",
    });
  }
  if (audit.datasetDetail.beaconDisabled) {
    criticalGaps.push(
      "Beacon tracking is disabled on this dataset, which prevents reliable web personalization analytics and may block web campaigns from performing as expected."
    );
    strategicRecommendations.push({
      priority: "immediate",
      title: "Re-enable beacon tracking or document exception",
      rationale: "Without beacon data, web channel ROI cannot be demonstrated to leadership.",
    });
  }
  if (audit.consumption) {
    const { limits, dataset: usage } = audit.consumption;
    if (limits.muv && usage.muvLatestMonth > limits.muv) {
      criticalGaps.push(
        `Monthly unique visitor usage (${usage.muvLatestMonth}) exceeds the contracted MUV limit (${limits.muv}). This creates commercial and platform risk.`
      );
      strategicRecommendations.push({
        priority: "immediate",
        title: "Engage Salesforce on consumption overage",
        rationale:
          "Contract limits may trigger throttling or commercial discussions; address before renewal.",
      });
    } else if (usage.muvTotal === 0 && usage.events === 0) {
      criticalGaps.push(
        "No measurable visitor or event activity was attributed to this dataset in the past twelve months — the instance may not be receiving production traffic."
      );
    }
  }

  for (const f of audit.findings) {
    if (
      f.severity === "high" &&
      !criticalGaps.some(
        (g) =>
          g.includes(f.finding.slice(0, 40)) ||
          f.finding.includes(g.slice(0, 40))
      )
    ) {
      criticalGaps.push(f.finding);
    }
    const exists = strategicRecommendations.some((r) =>
      r.title.toLowerCase().includes(f.recommendation.slice(0, 20).toLowerCase())
    );
    if (!exists && (f.severity === "high" || f.severity === "medium")) {
      strategicRecommendations.push({
        priority: f.severity === "high" ? "immediate" : "short_term",
        title: f.recommendation.split(".")[0] ?? f.recommendation,
        rationale: f.finding,
      });
    }
  }

  if (workingWell.length === 0) {
    workingWell.push(
      "The dataset infrastructure is in place; the primary opportunity is to convert configuration into measurable customer engagement."
    );
  }

  const healthRating = ratingFromScore(healthScore);
  const severity = countBySeverity(audit.findings);

  const instanceStory = [
    `**${audit.label}** (\`${audit.dataset}\`) is a Salesforce Marketing Cloud Personalization (Interaction Studio) dataset hosted at ${audit.instanceUrl}. `,
    `The estate comprises ${audit.campaigns.length} campaigns (${published.length} published), ${audit.segments.length} segments, ${audit.templateCount} templates, and ${audit.recipeUsage.recipes.length} recommendation recipes. `,
    audit.governance
      ? `${audit.governance.datasetUserCount} administrators have access to this dataset; ${audit.governance.roles.length} custom role definitions govern permissions account-wide. `
      : "",
    audit.consumption
      ? `Over the consumption review window, the dataset recorded ${audit.consumption.dataset.events} events and ${audit.consumption.dataset.muvTotal} monthly unique visitors (aggregated across months). `
      : "",
    yearImpressions === 0
      ? `However, campaign performance metrics show **no recorded impressions** in ${audit.statsYearRange}, which is the central narrative tension this assessment addresses: the platform is configured, but value realization is not yet visible in standard reports.`
      : `Campaign performance shows ${yearImpressions.toLocaleString()} impressions in ${audit.statsYearRange}, indicating active customer-facing activity.`,
  ].join("");

  const executiveSummary = [
    `Overall platform health for **${audit.label}** is assessed as **${healthRating}** (score ${healthScore}/100). `,
    `The instance has a mature configuration footprint — ${published.length} live campaigns and ${audit.segments.length} segments — `,
    yearImpressions === 0
      ? "but **cannot demonstrate personalization impact** in the current reporting period due to zero recorded campaign impressions. "
      : "and demonstrates measurable campaign activity in the review period. ",
    severity.high > 0
      ? `${severity.high} high-severity issue(s) require executive awareness. `
      : "No critical-severity findings were identified. ",
    severity.medium > 0
      ? `${severity.medium} medium-priority item(s) should be addressed in the next planning cycle. `
      : "",
    "This report prioritizes actionable recommendations over raw configuration export, and is intended for leadership review alongside technical appendix detail.",
  ].join("");

  const opsFindings = audit.findings.filter((f) =>
    /campaign|impression|beacon|recipe|segment|traffic|zone/i.test(f.finding)
  );
  const govFindings = audit.findings.filter((f) =>
    /user|2FA|SFTP|PII|permission|admin|access/i.test(f.finding)
  );
  const consumptionFindings = audit.findings.filter((f) =>
    /MUV|event|consumption|limit|traffic/i.test(f.finding)
  );

  const domainAssessments: DomainAssessment[] = [
    {
      domain: "Campaign & Personalization Operations",
      rating: domainRating(opsFindings, published.length),
      summary:
        published.length > 0
          ? `${published.length} campaigns are live across multiple channels; operational maturity is moderate.`
          : "No published campaigns — personalization operations are not active.",
      strengths: published.length
        ? [`${published.length} published campaigns`, `${audit.contentZones.length} content zones configured`]
        : [],
      concerns: [
        ...(yearImpressions === 0 ? ["Zero impressions in stats year window"] : []),
        ...(disabled.length ? [`${disabled.length} disabled campaigns on file`] : []),
        ...(testCampaigns.length ? ["Test/demo artifacts present"] : []),
      ],
      recommendations: [
        yearImpressions === 0
          ? "Run an end-to-end tagging and beacon validation on production properties."
          : "Continue quarterly campaign portfolio reviews to retire underperforming experiences.",
        disabled.length
          ? "Archive disabled campaigns or document retention rationale."
          : "Maintain campaign documentation for audit continuity.",
      ],
    },
    {
      domain: "Audience & Segmentation",
      rating: domainRating(
        audit.findings.filter((f) => /segment/i.test(f.finding)),
        segmentsHealthy
      ),
      summary: `${audit.segments.length} segments configured; ${segmentsHealthy} reporting healthy calculation.`,
      strengths:
        segmentsHealthy > 0
          ? [`${segmentsHealthy} segments with COMPLETE calc status`]
          : [],
      concerns: audit.segments.every((s) => s.endMemberCount === 0)
        ? ["All segments show zero members — may indicate low traffic or rule issues"]
        : [],
      recommendations: [
        "Validate segment rules against current traffic patterns quarterly.",
        "Align segment strategy with active campaign targeting.",
      ],
    },
    {
      domain: "Governance & Security",
      rating: domainRating(govFindings, audit.governance ? 1 : 0),
      summary: audit.governance
        ? `${audit.governance.totalUsers} users; ${audit.governance.usersWithout2fa} without 2FA.`
        : "Governance data not collected in this audit run.",
      strengths: audit.governance?.roles.length
        ? [`${audit.governance.roles.length} defined role templates for least-privilege access`]
        : [],
      concerns: [
        ...(audit.governance?.usersWithout2fa
          ? [`${audit.governance.usersWithout2fa} users without 2FA`]
          : []),
        ...(audit.governance?.sftpPrincipals.filter((p) => p.sftpDataset === audit.dataset).length
          ? ["SFTP integration enabled for this dataset"]
          : []),
      ],
      recommendations: [
        "Enable 2FA for all administrator accounts.",
        "Transition from blanket admin roles to Editor/Viewer roles where possible.",
        "Review SFTP credentials annually.",
      ],
    },
    {
      domain: "Platform Consumption & Commercial",
      rating: domainRating(consumptionFindings, audit.consumption ? 1 : 0),
      summary: audit.consumption
        ? `MUV cap ${audit.consumption.limits.muv?.toLocaleString() ?? "—"}; dataset MUV ${audit.consumption.dataset.muvTotal} (12-month window).`
        : "Consumption metrics not collected.",
      strengths:
        audit.consumption &&
        audit.consumption.limits.muv &&
        audit.consumption.dataset.muvLatestMonth < audit.consumption.limits.muv * 0.2
          ? ["Significant headroom below MUV contract limit"]
          : [],
      concerns: [
        ...(audit.consumption?.dataset.muvTotal === 0 ? ["No MUV attributed to dataset"] : []),
        ...(audit.consumption?.dataset.eventErrors
          ? [`${audit.consumption.dataset.eventErrors} event errors`]
          : []),
      ],
      recommendations: [
        "Review consumption dashboard monthly with platform owner.",
        "Align dataset traffic with contract renewal forecasting.",
      ],
    },
    {
      domain: "Data & Integration Configuration",
      rating: domainRating(
        audit.findings.filter((f) => /PII|tracking|integration/i.test(f.finding)),
        audit.datasetSettings ? 1 : 0
      ),
      summary: audit.datasetSettings
        ? `Dataset type: ${audit.datasetSettings.integrationSetup.datasetType ?? "—"}; ${audit.datasetSettings.userAttributes.length} user attributes.`
        : "Settings not collected.",
      strengths: [
        ...(audit.datasetSettings?.catalogConfigSummary.itemTypes.length
          ? [`Catalog: ${audit.datasetSettings.catalogConfigSummary.itemTypes.join(", ")}`]
          : []),
        ...(audit.datasetSettings?.integrationSetup.trackAnonymousVisitors === true
          ? ["Anonymous visitor tracking enabled"]
          : []),
      ],
      concerns: [
        ...(audit.datasetSettings?.piiAttributeCount
          ? [`${audit.datasetSettings.piiAttributeCount} PII-classified attributes`]
          : []),
      ],
      recommendations: [
        "Document data classification and retention for PII attributes.",
        "Confirm CRM / Marketing Cloud identity mappings remain accurate.",
      ],
    },
  ];

  const atAGlance: ExecutiveNarrative["atAGlance"] = [
    { label: "Overall health", value: `${healthRating} (${healthScore}/100)` },
    { label: "Dataset", value: `${audit.label} (${audit.dataset})` },
    { label: "Published campaigns", value: String(published.length) },
    { label: "Segments", value: String(audit.segments.length) },
    { label: "Findings (H/M/L)", value: `${severity.high} / ${severity.medium} / ${severity.low}` },
  ];
  if (audit.consumption) {
    atAGlance.push({
      label: "12-month events (dataset)",
      value: String(audit.consumption.dataset.events),
    });
    atAGlance.push({
      label: "MUV cap utilization (latest month)",
      value: audit.consumption.limits.muv
        ? `${audit.consumption.dataset.muvLatestMonth} / ${audit.consumption.limits.muv}`
        : "—",
    });
  }
  if (audit.governance) {
    atAGlance.push({ label: "Users with access", value: String(audit.governance.datasetUserCount) });
  }

  const prioritizedFindings = [...audit.findings].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  return {
    healthScore,
    healthRating,
    executiveSummary,
    instanceStory,
    workingWell,
    needsAttention,
    criticalGaps,
    strategicRecommendations,
    domainAssessments,
    atAGlance,
    prioritizedFindings,
  };
}
