import { z } from "zod";
import {
  fetchSegment,
  fetchSegmentRuleSummaries,
  SegmentDetail,
  SegmentRuleSummary,
} from "../api/segments.js";
import { DatasetParamSchema } from "../types/datasetSchema.js";
import { resolveDataset } from "../utils/dataset.js";

export const GetSegmentInputSchema = z.object({
  dataset: DatasetParamSchema,
  segment_id: z.string().min(1).describe("Segment id from list_segments"),
  include_rules: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include segment targeting rules"),
  include_raw: z
    .boolean()
    .optional()
    .default(false)
    .describe("Return full raw JSON instead of a formatted summary"),
});

export type GetSegmentInput = z.infer<typeof GetSegmentInputSchema>;

export const GET_SEGMENT_TOOL = {
  name: "get_segment",
  description:
    "Get details for a single Interaction Studio segment by id, including optional targeting rules.",
  inputSchema: {
    type: "object" as const,
    properties: {
      dataset: {
        type: "string",
        description: "Dataset name. Optional if IS_DEFAULT_DATASET is configured.",
      },
      segment_id: {
        type: "string",
        description: "Segment id from list_segments",
      },
      include_rules: {
        type: "boolean",
        description: "Include segment targeting rules (default: true)",
      },
      include_raw: {
        type: "boolean",
        description: "Return full raw JSON instead of formatted summary (default: false)",
      },
    },
    required: ["segment_id"],
  },
};

function formatTimestamp(ms?: number): string {
  if (!ms) return "—";
  return new Date(ms).toISOString();
}

function formatRule(rule: SegmentRuleSummary, index: number): string {
  const name = rule.name ?? rule.id ?? `Rule ${index + 1}`;
  const description = rule.description ? `\n    ${rule.description}` : "";
  return `  ${index + 1}. ${name}${description}`;
}

function formatSegmentSummary(
  segment: SegmentDetail,
  rules: SegmentRuleSummary[]
): string {
  const id = segment.id ?? "—";
  const name = segment.name ?? "—";
  const customerType = segment.customerType ?? "—";
  const enabled =
    segment.enabled === undefined ? "—" : segment.enabled ? "yes" : "no";
  const updated = formatTimestamp(segment.updated ?? segment.lastUpdated);
  const created = formatTimestamp(segment.created);

  const lines = [
    `Segment: ${name} (id: ${id})`,
    `Customer type: ${customerType}`,
    `Enabled: ${enabled}`,
    `Created: ${created}`,
    `Updated: ${updated}`,
  ];

  if (segment.description) {
    lines.push(`Description: ${segment.description}`);
  }

  const embeddedRules = segment.segmentRuleSummaries ?? [];
  const allRules = embeddedRules.length > 0 ? embeddedRules : rules;

  if (allRules.length > 0) {
    lines.push("", `Rules (${allRules.length}):`);
    lines.push(...allRules.map(formatRule));
  }

  return lines.join("\n");
}

export async function handleGetSegment(input: GetSegmentInput): Promise<string> {
  const dataset = resolveDataset(input.dataset);
  const segment = await fetchSegment(dataset, input.segment_id);
  const rules = input.include_rules
    ? await fetchSegmentRuleSummaries(dataset, input.segment_id)
    : [];

  if (input.include_raw) {
    return JSON.stringify({ segment, rules }, null, 2);
  }

  return formatSegmentSummary(segment, rules);
}
