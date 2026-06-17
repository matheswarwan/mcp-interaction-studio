import { CampaignDetail } from "../api/campaigns.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export interface CampaignRuleInfo {
  id?: string;
  description?: string;
  abbreviatedDescription?: string;
}

export interface CampaignTriggerInfo {
  type?: string;
  description?: string;
}

export interface ExperienceInsight {
  id: string;
  name: string;
  userPercentage?: number;
  contentZones: string[];
  recipeIds: string[];
  templateIds: string[];
}

export interface CampaignInsights {
  goal: string | null;
  goalSegmentId: string | null;
  goalSegmentNegated: boolean;
  controlUserPercentage?: number;
  controlExperienceId?: string;
  folderName?: string;
  folderSourceId?: string;
  rules: CampaignRuleInfo[];
  triggers: CampaignTriggerInfo[];
  experiences: ExperienceInsight[];
  contentZones: string[];
  recipeIds: string[];
  schedule?: string;
}

function collectRecipeIds(value: unknown, found: Set<string>): void {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectRecipeIds(item, found));
    return;
  }
  const obj = asRecord(value);
  if (!obj) return;

  if (typeof obj.recipeId === "string") found.add(obj.recipeId);
  const recipe = asRecord(obj.recipe);
  if (typeof recipe?.id === "string") found.add(recipe.id);

  for (const nested of Object.values(obj)) {
    if (nested && typeof nested === "object") collectRecipeIds(nested, found);
  }
}

function collectContentZones(value: unknown, found: Set<string>): void {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectContentZones(item, found));
    return;
  }
  const obj = asRecord(value);
  if (!obj) return;

  if (typeof obj.contentZone === "string" && obj.contentZone.trim()) {
    found.add(obj.contentZone.trim());
  }

  for (const nested of Object.values(obj)) {
    if (nested && typeof nested === "object") collectContentZones(nested, found);
  }
}

function formatSchedule(schedule: unknown): string | undefined {
  const obj = asRecord(schedule);
  if (!obj) return undefined;

  const parts: string[] = [];
  if (typeof obj.startDate === "number") {
    parts.push(`start: ${new Date(obj.startDate).toISOString()}`);
  }
  if (typeof obj.endDate === "number") {
    parts.push(`end: ${new Date(obj.endDate).toISOString()}`);
  }
  if (typeof obj.enabled === "boolean") {
    parts.push(`enabled: ${obj.enabled}`);
  }
  return parts.length > 0 ? parts.join(", ") : undefined;
}

export function extractCampaignInsights(
  campaign: CampaignDetail,
  context?: Record<string, unknown>
): CampaignInsights {
  const extra = campaign as Record<string, unknown>;
  const rules: CampaignRuleInfo[] = [];
  const ruleList = extra.rules;
  if (Array.isArray(ruleList)) {
    for (const rule of ruleList) {
      const obj = asRecord(rule);
      if (!obj) continue;
      rules.push({
        id: typeof obj.id === "string" ? obj.id : undefined,
        description: typeof obj.description === "string" ? obj.description : undefined,
        abbreviatedDescription:
          typeof obj.abbreviatedDescription === "string"
            ? obj.abbreviatedDescription
            : undefined,
      });
    }
  }

  const triggers: CampaignTriggerInfo[] = [];
  const triggerList = extra.triggerConfigs;
  if (Array.isArray(triggerList)) {
    for (const trigger of triggerList) {
      const obj = asRecord(trigger);
      if (!obj) continue;
      triggers.push({
        type: typeof obj.type === "string" ? obj.type : undefined,
        description:
          typeof obj.description === "string"
            ? obj.description
            : typeof obj.abbreviatedDescription === "string"
              ? obj.abbreviatedDescription
              : undefined,
      });
    }
  }

  const experiences: ExperienceInsight[] = [];
  const allContentZones = new Set<string>();
  const allRecipeIds = new Set<string>();

  const experienceList = extra.experiences;
  if (Array.isArray(experienceList)) {
    for (const exp of experienceList) {
      const obj = asRecord(exp);
      if (!obj) continue;

      const contentZones = new Set<string>();
      const recipeIds = new Set<string>();
      collectContentZones(obj, contentZones);
      collectRecipeIds(obj, recipeIds);

      contentZones.forEach((z) => allContentZones.add(z));
      recipeIds.forEach((r) => allRecipeIds.add(r));

      const templateIds: string[] = [];
      if (Array.isArray(obj.templateIds)) {
        for (const id of obj.templateIds) {
          if (typeof id === "string") templateIds.push(id);
        }
      }

      experiences.push({
        id: typeof obj.id === "string" ? obj.id : "—",
        name: typeof obj.name === "string" ? obj.name : "—",
        userPercentage: typeof obj.userPercentage === "number" ? obj.userPercentage : undefined,
        contentZones: [...contentZones],
        recipeIds: [...recipeIds],
        templateIds,
      });
    }
  }

  const ctx = context ?? {};
  const folderName =
    typeof ctx.folderName === "string"
      ? ctx.folderName
      : typeof extra.folderObjectName === "string"
        ? extra.folderObjectName
        : undefined;

  return {
    goal: typeof extra.successGauge === "string" ? extra.successGauge : null,
    goalSegmentId: typeof extra.goalSegmentId === "string" ? extra.goalSegmentId : null,
    goalSegmentNegated: extra.goalSegmentNegated === true,
    controlUserPercentage:
      typeof extra.controlUserPercentage === "number"
        ? extra.controlUserPercentage
        : undefined,
    controlExperienceId:
      typeof extra.controlExperienceId === "string" ? extra.controlExperienceId : undefined,
    folderName,
    folderSourceId:
      typeof ctx.folderId === "string"
        ? ctx.folderId
        : typeof extra.folderSourceId === "string"
          ? extra.folderSourceId
          : undefined,
    rules,
    triggers,
    experiences,
    contentZones: [...allContentZones],
    recipeIds: [...allRecipeIds],
    schedule: formatSchedule(extra.schedule),
  };
}

export function formatCampaignInsights(insights: CampaignInsights): string[] {
  const lines: string[] = [];

  if (insights.folderName) {
    lines.push(`Folder: ${insights.folderName}`);
  }
  if (insights.goal) {
    lines.push(`Goal: ${insights.goal}`);
  }
  if (insights.goalSegmentId) {
    lines.push(
      `Goal segment: ${insights.goalSegmentId}${insights.goalSegmentNegated ? " (negated)" : ""}`
    );
  }
  if (insights.controlUserPercentage !== undefined) {
    lines.push(
      `Control group: ${insights.controlUserPercentage}%` +
        (insights.controlExperienceId ? ` (experience: ${insights.controlExperienceId})` : "")
    );
  }
  if (insights.schedule) {
    lines.push(`Schedule: ${insights.schedule}`);
  }
  if (insights.contentZones.length > 0) {
    lines.push(`Content zones: ${insights.contentZones.join(", ")}`);
  }
  if (insights.recipeIds.length > 0) {
    lines.push(`Recipes: ${insights.recipeIds.join(", ")}`);
  }
  if (insights.rules.length > 0) {
    lines.push("", "Rules:");
    insights.rules.forEach((rule, i) => {
      const label = rule.abbreviatedDescription ?? rule.description ?? rule.id ?? "—";
      lines.push(`  ${i + 1}. ${label}`);
    });
  }
  if (insights.triggers.length > 0) {
    lines.push("", "Triggers:");
    insights.triggers.forEach((trigger, i) => {
      lines.push(`  ${i + 1}. ${trigger.description ?? trigger.type ?? "—"}`);
    });
  }
  if (insights.experiences.length > 0) {
    lines.push("", `Experience details (${insights.experiences.length}):`);
    insights.experiences.forEach((exp, i) => {
      let line = `  ${i + 1}. ${exp.name} (id: ${exp.id})`;
      if (exp.userPercentage !== undefined) line += ` — ${exp.userPercentage}% traffic`;
      lines.push(line);
      if (exp.contentZones.length > 0) {
        lines.push(`     zones: ${exp.contentZones.join(", ")}`);
      }
      if (exp.recipeIds.length > 0) {
        lines.push(`     recipes: ${exp.recipeIds.join(", ")}`);
      }
      if (exp.templateIds.length > 0) {
        lines.push(`     templates: ${exp.templateIds.join(", ")}`);
      }
    });
  }

  return lines;
}
