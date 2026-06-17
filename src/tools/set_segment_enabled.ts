import { z } from "zod";
import { setSegmentEnabled } from "../api/segmentWrites.js";
import { fetchSegment } from "../api/segments.js";
import { DatasetParamSchema } from "../types/datasetSchema.js";
import { resolveDataset } from "../utils/dataset.js";
import { assertConfirmed, assertWritesEnabled } from "../utils/writes.js";

export const SetSegmentEnabledInputSchema = z.object({
  dataset: DatasetParamSchema,
  segment_id: z.string().min(1),
  enabled: z.boolean(),
  dry_run: z.boolean().optional().default(true),
  confirm: z.boolean().optional().default(false),
});

export type SetSegmentEnabledInput = z.infer<typeof SetSegmentEnabledInputSchema>;

export const SET_SEGMENT_ENABLED_TOOL = {
  name: "set_segment_enabled",
  description:
    "Enable or disable an Interaction Studio segment. Requires IS_WRITES_ENABLED=true and confirm=true. Defaults to dry_run preview.",
  inputSchema: {
    type: "object" as const,
    properties: {
      dataset: {
        type: "string",
        description: "Dataset name. Optional if IS_DEFAULT_DATASET is configured.",
      },
      segment_id: { type: "string", description: "Segment id from list_segments" },
      enabled: { type: "boolean", description: "true to enable, false to disable" },
      dry_run: {
        type: "boolean",
        description: "Preview only, no write (default: true)",
      },
      confirm: {
        type: "boolean",
        description: "Required to execute when dry_run=false (default: false)",
      },
    },
    required: ["segment_id", "enabled"],
  },
};

function segmentIsEnabled(segment: Record<string, unknown>): boolean {
  if (segment.disabled === true) return false;
  if (segment.disabled === false) return true;
  if (segment.enabled === true) return true;
  if (segment.enabled === false) return false;
  return true;
}

export async function handleSetSegmentEnabled(
  input: SetSegmentEnabledInput
): Promise<string> {
  const dataset = resolveDataset(input.dataset);
  const segment = await fetchSegment(dataset, input.segment_id);
  const extra = segment as Record<string, unknown>;
  const currentlyEnabled = segmentIsEnabled(extra);
  const name = segment.name ?? input.segment_id;

  const dryRun = input.dry_run ?? true;
  const confirm = input.confirm ?? false;

  if (dryRun) {
    return [
      `Dry run: set segment enabled state`,
      `Dataset: ${dataset}`,
      `Segment: ${name} (${input.segment_id})`,
      `Currently enabled: ${currentlyEnabled ? "yes" : "no"}`,
      `Target enabled: ${input.enabled ? "yes" : "no"}`,
      currentlyEnabled === input.enabled
        ? "No change needed."
        : "To apply: set dry_run=false and confirm=true (requires IS_WRITES_ENABLED=true).",
    ].join("\n");
  }

  assertConfirmed(confirm, dryRun);
  assertWritesEnabled();

  const result = await setSegmentEnabled(dataset, input.segment_id, input.enabled);

  return [
    `Segment updated in "${dataset}".`,
    `Segment: ${result.segment.name ?? input.segment_id} (${input.segment_id})`,
    `Previously enabled: ${result.previousDisabled === undefined ? "—" : result.previousDisabled ? "no" : "yes"}`,
    `Now enabled: ${result.enabled ? "yes" : "no"}`,
  ].join("\n");
}
