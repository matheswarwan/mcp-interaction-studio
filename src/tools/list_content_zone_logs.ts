import { z } from "zod";
import { fetchContentZoneLogs } from "../api/contentZones.js";
import { DatasetParamSchema } from "../types/datasetSchema.js";
import { resolveDataset } from "../utils/dataset.js";

export const ListContentZoneLogsInputSchema = z.object({
  dataset: DatasetParamSchema,
  time_range: z.string().optional().default("pastWeek"),
});

export type ListContentZoneLogsInput = z.infer<typeof ListContentZoneLogsInputSchema>;

export const LIST_CONTENT_ZONE_LOGS_TOOL = {
  name: "list_content_zone_logs",
  description:
    "List content zone activity logs for an Interaction Studio dataset within a time range.",
  inputSchema: {
    type: "object" as const,
    properties: {
      dataset: {
        type: "string",
        description: "Dataset name. Optional if IS_DEFAULT_DATASET is configured.",
      },
      time_range: {
        type: "string",
        description: "pastDay, pastWeek (default), pastMonth, pastQuarter, Today, or YYYY-MM-DD..YYYY-MM-DD",
      },
    },
    required: [],
  },
};

export async function handleListContentZoneLogs(
  input: ListContentZoneLogsInput
): Promise<string> {
  const dataset = resolveDataset(input.dataset);
  const logs = await fetchContentZoneLogs(dataset, input.time_range);

  if (logs.length === 0) {
    return `No content zone logs in "${dataset}" for time range "${input.time_range}".`;
  }

  const lines = logs.map((entry, i) => {
    const zone = entry.contentZone ?? entry.name ?? `entry ${i + 1}`;
    const updated =
      entry.updated !== undefined
        ? new Date(entry.updated).toISOString().slice(0, 10)
        : "—";
    return `• ${zone} | modified: ${updated}`;
  });

  return (
    `Found ${logs.length} content zone log(s) in "${dataset}" (${input.time_range}):\n\n` +
    lines.join("\n")
  );
}
