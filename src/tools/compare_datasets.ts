import { z } from "zod";
import { buildDatasetAudit } from "../audit/buildAudit.js";
import { DatasetParamSchema } from "../types/datasetSchema.js";
import { resolveDataset } from "../utils/dataset.js";

export const CompareDatasetsInputSchema = z.object({
  dataset_a: DatasetParamSchema,
  dataset_b: z.string().min(1),
  time_range: z.string().optional().default("pastQuarter"),
});

export type CompareDatasetsInput = z.infer<typeof CompareDatasetsInputSchema>;

export const COMPARE_DATASETS_TOOL = {
  name: "compare_datasets",
  description:
    "Compare two Interaction Studio datasets side-by-side: counts, campaign states, segment populations, recipe linkage, and activity.",
  inputSchema: {
    type: "object" as const,
    properties: {
      dataset_a: {
        type: "string",
        description: "First dataset name. Optional if IS_DEFAULT_DATASET is configured.",
      },
      dataset_b: {
        type: "string",
        description: "Second dataset name (required)",
      },
      time_range: {
        type: "string",
        description: "Stats window for comparison (default: pastQuarter)",
      },
    },
    required: ["dataset_b"],
  },
};

function sumImpressions(
  campaigns: Awaited<ReturnType<typeof buildDatasetAudit>>["campaigns"],
  field: "statsQuarter" | "statsYear"
): number {
  return campaigns.reduce((sum, c) => sum + c[field].impressions, 0);
}

export async function handleCompareDatasets(
  input: CompareDatasetsInput
): Promise<string> {
  const datasetA = resolveDataset(input.dataset_a);
  const datasetB = input.dataset_b;
  const timeRange = input.time_range ?? "pastQuarter";

  const [auditA, auditB] = await Promise.all([
    buildDatasetAudit({ dataset: datasetA, timeRange }),
    buildDatasetAudit({ dataset: datasetB, timeRange }),
  ]);

  const publishedA = auditA.campaigns.filter((c) => c.state === "Published").length;
  const publishedB = auditB.campaigns.filter((c) => c.state === "Published").length;
  const disabledA = auditA.campaigns.filter((c) => c.state === "Disabled").length;
  const disabledB = auditB.campaigns.filter((c) => c.state === "Disabled").length;

  const segmentMembersA = auditA.segments.reduce(
    (sum, s) => sum + (s.endMemberCount ?? s.memberCount ?? 0),
    0
  );
  const segmentMembersB = auditB.segments.reduce(
    (sum, s) => sum + (s.endMemberCount ?? s.memberCount ?? 0),
    0
  );

  const lines = [
    `Dataset comparison (${timeRange})`,
    "",
    "| Metric | " + `${auditA.label} (\`${auditA.dataset}\`)` + " | " + `${auditB.label} (\`${auditB.dataset}\`)` + " |",
    "|--------|------:|------:|",
    `| State | ${auditA.datasetDetail.state ?? "—"} | ${auditB.datasetDetail.state ?? "—"} |`,
    `| Campaigns | ${auditA.campaigns.length} | ${auditB.campaigns.length} |`,
    `| Published | ${publishedA} | ${publishedB} |`,
    `| Disabled | ${disabledA} | ${disabledB} |`,
    `| Segments | ${auditA.segments.length} | ${auditB.segments.length} |`,
    `| Segment members (end) | ${segmentMembersA} | ${segmentMembersB} |`,
    `| Templates | ${auditA.templateCount} | ${auditB.templateCount} |`,
    `| Recipes | ${auditA.recipeUsage.recipes.length} | ${auditB.recipeUsage.recipes.length} |`,
    `| Unlinked recipes | ${auditA.recipeUsage.unlinkedRecipeIds.length} | ${auditB.recipeUsage.unlinkedRecipeIds.length} |`,
    `| Surveys | ${auditA.surveyCount} | ${auditB.surveyCount} |`,
    `| Content zones | ${auditA.contentZones.length} | ${auditB.contentZones.length} |`,
    `| Impressions (${timeRange}) | ${sumImpressions(auditA.campaigns, "statsQuarter")} | ${sumImpressions(auditB.campaigns, "statsQuarter")} |`,
    `| Impressions (${auditA.statsYearRange}) | ${sumImpressions(auditA.campaigns, "statsYear")} | ${sumImpressions(auditB.campaigns, "statsYear")} |`,
    `| Findings | ${auditA.findings.length} | ${auditB.findings.length} |`,
    "",
    "Campaigns only in A:",
    ...onlyIn(auditA.campaigns.map((c) => c.name), auditB.campaigns.map((c) => c.name)),
    "",
    "Campaigns only in B:",
    ...onlyIn(auditB.campaigns.map((c) => c.name), auditA.campaigns.map((c) => c.name)),
  ];

  return lines.join("\n");
}

function onlyIn(left: string[], right: string[]): string[] {
  const rightSet = new Set(right.map((n) => n.toLowerCase()));
  const unique = left.filter((n) => !rightSet.has(n.toLowerCase()));
  if (unique.length === 0) return ["  (none)"];
  return unique.map((n) => `  - ${n}`);
}
