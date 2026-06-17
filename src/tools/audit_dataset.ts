import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import { buildDatasetAudit } from "../audit/buildAudit.js";
import { formatAuditMarkdown } from "../audit/formatAuditMarkdown.js";
import { DatasetParamSchema } from "../types/datasetSchema.js";
import { resolveDataset } from "../utils/dataset.js";

export const AuditDatasetInputSchema = z.object({
  dataset: DatasetParamSchema,
  time_range: z.string().optional().default("pastQuarter"),
  stats_year_range: z.string().optional(),
  output_format: z.enum(["markdown", "json"]).optional().default("markdown"),
  output_path: z.string().optional(),
});

export type AuditDatasetInput = z.infer<typeof AuditDatasetInputSchema>;

export const AUDIT_DATASET_TOOL = {
  name: "audit_dataset",
  description:
    "Run a complete Interaction Studio dataset audit: configuration, campaigns, segments, templates, recipe usage, stats, and findings. Returns markdown or JSON; optionally writes to a file.",
  inputSchema: {
    type: "object" as const,
    properties: {
      dataset: {
        type: "string",
        description: "Dataset name. Optional if IS_DEFAULT_DATASET is configured.",
      },
      time_range: {
        type: "string",
        description: "Stats window for campaigns/segments (default: pastQuarter)",
      },
      stats_year_range: {
        type: "string",
        description: "Second stats window for year comparison, e.g. 2026-01-01..2026-12-31",
      },
      output_format: {
        type: "string",
        enum: ["markdown", "json"],
        description: "Return markdown report (default) or raw JSON audit object",
      },
      output_path: {
        type: "string",
        description: "Optional absolute or relative path to write the report file",
      },
    },
    required: [],
  },
};

export async function handleAuditDataset(input: AuditDatasetInput): Promise<string> {
  const dataset = resolveDataset(input.dataset);
  const audit = await buildDatasetAudit({
    dataset,
    timeRange: input.time_range,
    statsYearRange: input.stats_year_range,
  });

  const content =
    input.output_format === "json"
      ? JSON.stringify(audit, null, 2)
      : formatAuditMarkdown(audit);

  if (input.output_path) {
    const resolved = path.resolve(input.output_path);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content, "utf8");
    const ext = input.output_format === "json" ? "json" : "md";
    return `Audit complete for "${dataset}" (${audit.label}).\n\nWrote ${ext.toUpperCase()} report to: ${resolved}\n\nSummary: ${audit.campaigns.length} campaigns, ${audit.segments.length} segments, ${audit.findings.length} finding(s).`;
  }

  return content;
}
