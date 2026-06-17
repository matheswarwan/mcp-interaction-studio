import { fetchCampaignSummaries, fetchCampaign } from "../api/campaigns.js";
import { fetchRecipeSummaries, RecipeSummary } from "../api/recipes.js";
import { extractCampaignInsights } from "./campaignInsights.js";

export interface RecipeUsageEntry {
  recipeId: string;
  recipeName: string;
  inUseFlag: boolean;
  campaigns: Array<{
    id: string;
    name: string;
    state?: string;
    experienceIds: string[];
  }>;
}

export interface RecipeUsageReport {
  dataset: string;
  recipes: RecipeUsageEntry[];
  unlinkedRecipeIds: string[];
}

export async function buildRecipeUsageReport(
  dataset: string,
  timeRange = "pastQuarter"
): Promise<RecipeUsageReport> {
  const [recipes, campaignSummaries] = await Promise.all([
    fetchRecipeSummaries(dataset),
    fetchCampaignSummaries(dataset, timeRange),
  ]);

  const recipeMap = new Map<string, RecipeSummary>();
  for (const recipe of recipes) {
    recipeMap.set(recipe.id, recipe);
  }

  const usage = new Map<string, RecipeUsageEntry>();

  for (const recipe of recipes) {
    usage.set(recipe.id, {
      recipeId: recipe.id,
      recipeName: recipe.name,
      inUseFlag: recipe.liveRecipeSummary?.inUse === true,
      campaigns: [],
    });
  }

  for (const summary of campaignSummaries) {
    const campaign = await fetchCampaign(dataset, summary.id);
    const insights = extractCampaignInsights(campaign);

    for (const recipeId of insights.recipeIds) {
      let entry = usage.get(recipeId);
      if (!entry) {
        entry = {
          recipeId,
          recipeName: recipeMap.get(recipeId)?.name ?? recipeId,
          inUseFlag: recipeMap.get(recipeId)?.liveRecipeSummary?.inUse === true,
          campaigns: [],
        };
        usage.set(recipeId, entry);
      }

      const experienceIds = insights.experiences
        .filter((exp) => exp.recipeIds.includes(recipeId))
        .map((exp) => exp.id);

      entry.campaigns.push({
        id: summary.id,
        name: summary.name,
        state: summary.state,
        experienceIds,
      });
    }
  }

  const recipesList = [...usage.values()].sort((a, b) =>
    a.recipeName.localeCompare(b.recipeName)
  );

  const unlinkedRecipeIds = recipesList
    .filter((r) => r.campaigns.length === 0)
    .map((r) => r.recipeId);

  return { dataset, recipes: recipesList, unlinkedRecipeIds };
}

export function formatRecipeUsageReport(report: RecipeUsageReport): string {
  if (report.recipes.length === 0) {
    return `No recipes found in dataset "${report.dataset}".`;
  }

  const lines = [`Recipe usage in "${report.dataset}":`, ""];

  for (const recipe of report.recipes) {
    const linked = recipe.campaigns.length > 0;
    lines.push(`• ${recipe.recipeName} (id: ${recipe.recipeId})`);
    lines.push(`  API inUse flag: ${recipe.inUseFlag ? "yes" : "no"}`);
    lines.push(`  Linked campaigns: ${linked ? recipe.campaigns.length : "none"}`);
    if (linked) {
      for (const campaign of recipe.campaigns) {
        const exp =
          campaign.experienceIds.length > 0
            ? ` [experiences: ${campaign.experienceIds.join(", ")}]`
            : "";
        lines.push(`    - ${campaign.name} (${campaign.id}) — ${campaign.state ?? "—"}${exp}`);
      }
    }
    lines.push("");
  }

  if (report.unlinkedRecipeIds.length > 0) {
    lines.push(
      `Unlinked recipes (not referenced by any campaign): ${report.unlinkedRecipeIds.join(", ")}`
    );
  }

  return lines.join("\n").trimEnd();
}
