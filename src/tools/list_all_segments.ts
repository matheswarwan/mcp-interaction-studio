import { z } from "zod";
import { fetchDatasetSummaries } from "../api/datasets.js";
import { fetchSegmentSummaries } from "../api/segments.js";

export const ListAllSegmentsInputSchema = z.object({
  dataset: z
    .string()
    .optional()
    .describe("Optional: only list segments for this dataset. Omit to scan all datasets."),
});

export type ListAllSegmentsInput = z.infer<typeof ListAllSegmentsInputSchema>;

export const LIST_ALL_SEGMENTS_TOOL = {
  name: "list_all_segments",
  description:
    "List segments across all Interaction Studio datasets, or filter to a single dataset.",
  inputSchema: {
    type: "object" as const,
    properties: {
      dataset: {
        type: "string",
        description: "Optional dataset name. Omit to list segments in every dataset.",
      },
    },
    required: [],
  },
};

export async function handleListAllSegments(
  input: ListAllSegmentsInput
): Promise<string> {
  const datasets = await fetchDatasetSummaries();
  const targets = input.dataset
    ? datasets.filter((d) => d.name === input.dataset)
    : datasets;

  if (input.dataset && targets.length === 0) {
    return `Dataset "${input.dataset}" not found.`;
  }

  const sections: string[] = [];

  for (const ds of targets) {
    const segments = await fetchSegmentSummaries(ds.name);
    sections.push(`${ds.label} (${ds.name}) — ${segments.length} segment(s):`);

    if (segments.length === 0) {
      sections.push("  (none)");
    } else {
      for (const seg of segments) {
        sections.push(`  • ${seg.name ?? "—"} (id: ${seg.itemSourceId ?? "—"})`);
      }
    }

    sections.push("");
  }

  return sections.join("\n").trim();
}
