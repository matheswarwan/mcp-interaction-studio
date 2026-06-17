import { z } from "zod";
import { fetchSegmentSummaries } from "../api/segments.js";
import { fetchSegmentStats } from "../api/segmentDetails.js";
import { DatasetParamSchema } from "../types/datasetSchema.js";
import { resolveDataset } from "../utils/dataset.js";

export const ListSegmentStatsInputSchema = z.object({
  dataset: DatasetParamSchema,
  time_range: z.string().optional().default("pastQuarter"),
  segment_ids: z.array(z.string()).optional(),
  include_raw: z.boolean().optional().default(false),
});

export type ListSegmentStatsInput = z.infer<typeof ListSegmentStatsInputSchema>;

export const LIST_SEGMENT_STATS_TOOL = {
  name: "list_segment_stats",
  description:
    "List membership counts and calculation status for all segments (or a filtered list) in a dataset.",
  inputSchema: {
    type: "object" as const,
    properties: {
      dataset: {
        type: "string",
        description: "Dataset name. Optional if IS_DEFAULT_DATASET is configured.",
      },
      time_range: {
        type: "string",
        description: "pastDay, pastWeek, pastMonth, pastQuarter, Today, or YYYY-MM-DD..YYYY-MM-DD",
      },
      segment_ids: {
        type: "array",
        items: { type: "string" },
        description: "Optional segment ids; omit to include all segments",
      },
      include_raw: {
        type: "boolean",
        description: "Return raw JSON (default: false)",
      },
    },
    required: [],
  },
};

export async function handleListSegmentStats(
  input: ListSegmentStatsInput
): Promise<string> {
  const dataset = resolveDataset(input.dataset);
  const timeRange = input.time_range ?? "pastQuarter";
  const summaries = await fetchSegmentSummaries(dataset);

  const nameById = new Map<string, string>();
  let ids = summaries
    .map((s) => {
      const id = s.itemSourceId;
      if (id) nameById.set(id, s.name ?? id);
      return id;
    })
    .filter((id): id is string => typeof id === "string");

  if (input.segment_ids && input.segment_ids.length > 0) {
    const filter = new Set(input.segment_ids);
    ids = ids.filter((id) => filter.has(id));
  }

  if (ids.length === 0) {
    return `No segments found in dataset "${dataset}".`;
  }

  const stats = await fetchSegmentStats(dataset, ids, timeRange);

  if (input.include_raw) {
    return JSON.stringify(stats, null, 2);
  }

  const lines = [
    `Segment stats for "${dataset}" (${timeRange}) — ${stats.length} segment(s):`,
    "",
    "| Segment | ID | Start | End | Calc status |",
    "|---------|----|------:|----:|-------------|",
  ];

  for (const entry of stats) {
    const id = entry.id ?? entry.segmentId ?? "—";
    const name = nameById.get(id) ?? id;
    lines.push(
      `| ${name} | \`${id}\` | ${entry.startMemberCount ?? "—"} | ${entry.endMemberCount ?? "—"} | ${entry.mostRecentNightlyCalcStatus ?? entry.currentStatus ?? "—"} |`
    );
  }

  return lines.join("\n");
}
