import { CampaignDetail } from "../api/campaigns.js";
import { extractCampaignInsights, formatCampaignInsights } from "./campaignInsights.js";

function formatTimestamp(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toISOString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function formatRuleSummary(rule: unknown): string | null {
  const obj = asRecord(rule);
  if (!obj) return null;

  const parts: string[] = [];
  if (typeof obj.name === "string") parts.push(obj.name);
  if (typeof obj.description === "string") parts.push(obj.description);
  if (typeof obj.rule === "string") parts.push(obj.rule);

  const summaries = obj.segmentRuleSummaries ?? obj.ruleSummaries;
  if (Array.isArray(summaries) && summaries.length > 0) {
    parts.push(`${summaries.length} rule(s)`);
  }

  return parts.length > 0 ? parts.join(" — ") : JSON.stringify(obj).slice(0, 120);
}

function formatExperience(exp: unknown, index: number): string {
  const obj = asRecord(exp);
  if (!obj) return `  ${index + 1}. (unknown experience)`;

  const id = typeof obj.id === "string" ? obj.id : "—";
  const name = typeof obj.name === "string" ? obj.name : id;
  const state = typeof obj.state === "string" ? obj.state : "—";
  const weight = obj.weight ?? obj.trafficAllocation;

  let line = `  ${index + 1}. ${name} (id: ${id}) — state: ${state}`;
  if (weight !== undefined) line += `, weight: ${weight}`;
  return line;
}

export function formatCampaignSummary(campaign: CampaignDetail): string {
  const lines = [
    `Campaign: ${campaign.name} (id: ${campaign.id})`,
    `State: ${campaign.state ?? "—"}`,
    `Priority: ${campaign.priority ?? "—"}`,
    `Created: ${formatTimestamp(campaign.created)}`,
    `Updated: ${formatTimestamp(campaign.updated)}`,
  ];

  const extra = campaign as Record<string, unknown>;
  if (typeof extra.medium === "string") lines.push(`Medium: ${extra.medium}`);
  if (typeof extra.source === "string") lines.push(`Source: ${extra.source}`);
  if (typeof extra.campaignType === "string") lines.push(`Type: ${extra.campaignType}`);

  const targeting = formatRuleSummary(extra.targetingRule ?? extra.targeting);
  if (targeting) {
    lines.push("", "Targeting:", `  ${targeting}`);
  }

  const insights = extractCampaignInsights(campaign);
  const insightLines = formatCampaignInsights(insights);
  if (insightLines.length > 0) {
    lines.push("", ...insightLines);
  } else {
    const experiences = extra.experiences;
    if (Array.isArray(experiences) && experiences.length > 0) {
      lines.push("", `Experiences (${experiences.length}):`);
      experiences.forEach((exp, i) => lines.push(formatExperience(exp, i)));
    }

    const contentZones = extra.contentZones;
    if (Array.isArray(contentZones) && contentZones.length > 0) {
      lines.push("", `Content zones: ${contentZones.join(", ")}`);
    }
  }

  return lines.join("\n");
}
