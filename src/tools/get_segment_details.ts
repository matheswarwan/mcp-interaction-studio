import { z } from "zod";
import {
  fetchGlobalSegmentStats,
  fetchSegmentDetails,
  fetchSegmentStats,
} from "../api/segmentDetails.js";
import { DatasetParamSchema } from "../types/datasetSchema.js";
import { resolveDataset } from "../utils/dataset.js";

export const GetSegmentDetailsInputSchema = z.object({
  dataset: DatasetParamSchema,
  segment_id: z.string().min(1),
  time_range: z.string().optional().default("pastWeek"),
  include_stats: z.boolean().optional().default(true),
  include_raw: z.boolean().optional().default(false),
});

export type GetSegmentDetailsInput = z.infer<typeof GetSegmentDetailsInputSchema>;

export const GET_SEGMENT_DETAILS_TOOL = {
  name: "get_segment_details",
  description:
    "Get extended segment details including membership counts and optional live stats.",
  inputSchema: {
    type: "object" as const,
    properties: {
      dataset: {
        type: "string",
        description: "Dataset name. Optional if IS_DEFAULT_DATASET is configured.",
      },
      segment_id: { type: "string", description: "Segment id from list_segments" },
      time_range: {
        type: "string",
        description: "pastDay, pastWeek (default), pastMonth, pastQuarter, Today, or YYYY-MM-DD..YYYY-MM-DD",
      },
      include_stats: {
        type: "boolean",
        description: "Include segment membership stats (default: true)",
      },
      include_raw: { type: "boolean", description: "Return full raw JSON (default: false)" },
    },
    required: ["segment_id"],
  },
};

function pickMemberCount(entry: Record<string, unknown>): number | undefined {
  for (const key of ["memberCount", "userCount", "count", "members"]) {
    const val = entry[key];
    if (typeof val === "number") return val;
  }
  return undefined;
}

function formatTimestamp(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toISOString();
}

export async function handleGetSegmentDetails(
  input: GetSegmentDetailsInput
): Promise<string> {
  const dataset = resolveDataset(input.dataset);
  const details = await fetchSegmentDetails(
    dataset,
    input.segment_id,
    input.time_range
  );

  let stats: Record<string, unknown> | null = null;
  if (input.include_stats) {
    try {
      const entries = await fetchSegmentStats(
        dataset,
        [input.segment_id],
        input.time_range
      );
      stats = (entries[0] as Record<string, unknown>) ?? null;
    } catch {
      try {
        const globalStats = await fetchGlobalSegmentStats(dataset);
        if (Array.isArray(globalStats)) {
          stats =
            (globalStats.find(
              (s) =>
                (s as Record<string, unknown>).segmentId === input.segment_id ||
                (s as Record<string, unknown>).id === input.segment_id
            ) as Record<string, unknown>) ?? null;
        }
      } catch {
        stats = null;
      }
    }
  }

  if (input.include_raw) {
    return JSON.stringify({ details, stats }, null, 2);
  }

  const lines = [
    `Segment: ${details.name ?? "—"} (id: ${details.id ?? input.segment_id})`,
    `Customer type: ${details.customerType ?? "—"}`,
    `Enabled: ${
      details.disabled === undefined
        ? details.enabled === undefined
          ? "—"
          : details.enabled
            ? "yes"
            : "no"
        : details.disabled
          ? "no"
          : "yes"
    }`,
    `Created: ${formatTimestamp(details.created)}`,
    `Updated: ${formatTimestamp(details.updated ?? details.lastUpdated)}`,
  ];

  if (details.description) {
    lines.push(`Description: ${details.description}`);
  }

  const memberCount =
    pickMemberCount(details as Record<string, unknown>) ??
    (stats ? pickMemberCount(stats) : undefined);

  const startCount = stats?.startMemberCount;
  const endCount = stats?.endMemberCount;

  if (memberCount !== undefined) {
    lines.push(`Member count: ${memberCount}`);
  } else if (typeof startCount === "number" || typeof endCount === "number") {
    lines.push(
      `Member count: ${endCount ?? startCount ?? 0} (start: ${startCount ?? "—"}, end: ${endCount ?? "—"})`
    );
  } else if (input.include_stats) {
    lines.push("Member count: unavailable for this segment");
  }

  if (stats?.currentStatus) {
    lines.push(`Calculation status: ${stats.currentStatus}`);
  }

  return lines.join("\n");
}
