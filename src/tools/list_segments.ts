import { z } from "zod";
import { fetchSegmentSummaries } from "../api/segments.js";
import { DatasetParamSchema } from "../types/datasetSchema.js";
import { resolveDataset } from "../utils/dataset.js";

export const ListSegmentsInputSchema = z.object({
  dataset: DatasetParamSchema,
});

export type ListSegmentsInput = z.infer<typeof ListSegmentsInputSchema>;

export const LIST_SEGMENTS_TOOL = {
  name: "list_segments",
  description:
    "List all segments in an Interaction Studio dataset, including segment id and name.",
  inputSchema: {
    type: "object" as const,
    properties: {
      dataset: {
        type: "string",
        description: "Dataset name. Optional if IS_DEFAULT_DATASET is configured.",
      },
    },
    required: [],
  },
};

function formatModified(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toISOString().slice(0, 10);
}

export async function handleListSegments(input: ListSegmentsInput): Promise<string> {
  const dataset = resolveDataset(input.dataset);
  const segments = await fetchSegmentSummaries(dataset);

  if (segments.length === 0) {
    return `No segments found in dataset "${dataset}".`;
  }

  const lines = segments.map((segment) => {
    const id = segment.itemSourceId ?? "—";
    const folder = segment.folderObjectName ?? segment.folderSourceId ?? "—";
    return [
      `• ${segment.name ?? "—"} (id: ${id})`,
      `  folder: ${folder} | modified: ${formatModified(segment.updated)}`,
    ].join("\n");
  });

  return `Found ${segments.length} segment(s) in "${dataset}":\n\n${lines.join("\n\n")}`;
}
