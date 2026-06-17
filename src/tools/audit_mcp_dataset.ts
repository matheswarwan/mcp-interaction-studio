import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  buildMcpDatasetAudit,
  MCP_AUDIT_SECTIONS,
  McpAuditSection,
} from "../audit/buildMcpDatasetAudit.js";
import {
  docxPathFromMarkdown,
  exportExecutiveDocx,
} from "../audit/exportExecutiveDocx.js";
import { formatExecutiveAuditMarkdown } from "../audit/formatExecutiveAudit.js";
import { formatMcpAuditMarkdown } from "../audit/formatMcpAuditMarkdown.js";
import { DatasetParamSchema } from "../types/datasetSchema.js";
import { resolveDataset } from "../utils/dataset.js";

export const AuditMcpDatasetInputSchema = z.object({
  dataset: DatasetParamSchema,
  time_range: z.string().optional().default("pastQuarter"),
  stats_year_range: z.string().optional(),
  consumption_start: z.number().optional(),
  consumption_end: z.number().optional(),
  sections: z
    .array(z.enum(["governance", "consumption", "settings"] as const))
    .optional(),
  report_style: z.enum(["executive", "technical"]).optional().default("executive"),
  output_format: z.enum(["markdown", "json", "docx"]).optional().default("markdown"),
  export_docx: z.boolean().optional().default(true),
  output_path: z.string().optional(),
});

export type AuditMcpDatasetInput = z.infer<typeof AuditMcpDatasetInputSchema>;

export const AUDIT_MCP_DATASET_TOOL = {
  name: "audit_mcp_dataset",
  description:
    "Executive-ready orchestrated dataset audit: narrative assessment with health rating, strengths/gaps, recommendations, governance, consumption, and settings. Outputs markdown and/or DOCX.",
  inputSchema: {
    type: "object" as const,
    properties: {
      dataset: {
        type: "string",
        description: "Dataset name. Optional if IS_DEFAULT_DATASET is configured.",
      },
      time_range: {
        type: "string",
        description: "Campaign/segment stats window (default: pastQuarter)",
      },
      stats_year_range: {
        type: "string",
        description: "Second stats window, e.g. 2026-01-01..2026-12-31",
      },
      consumption_start: {
        type: "number",
        description: "Consumption window start (epoch ms). Default: 12 months ago",
      },
      consumption_end: {
        type: "number",
        description: "Consumption window end (epoch ms). Default: now",
      },
      sections: {
        type: "array",
        items: {
          type: "string",
          enum: [...MCP_AUDIT_SECTIONS],
        },
        description:
          "Optional sections: governance, consumption, settings (default: all)",
      },
      report_style: {
        type: "string",
        enum: ["executive", "technical"],
        description:
          "executive = board-ready narrative (default); technical = detailed API-style inventory",
      },
      output_format: {
        type: "string",
        enum: ["markdown", "json", "docx"],
        description: "markdown (default), json (raw data), or docx (Word document)",
      },
      export_docx: {
        type: "boolean",
        description:
          "When saving markdown, also write a .docx alongside (default: true)",
      },
      output_path: {
        type: "string",
        description: "Optional path to write report (.md and/or .docx)",
      },
    },
    required: [],
  },
};

function formatMarkdown(audit: Awaited<ReturnType<typeof buildMcpDatasetAudit>>, style: string): string {
  return style === "technical"
    ? formatMcpAuditMarkdown(audit)
    : formatExecutiveAuditMarkdown(audit);
}

export async function handleAuditMcpDataset(input: AuditMcpDatasetInput): Promise<string> {
  const dataset = resolveDataset(input.dataset);
  const consumptionRange =
    input.consumption_start !== undefined && input.consumption_end !== undefined
      ? { start: input.consumption_start, end: input.consumption_end }
      : undefined;

  const audit = await buildMcpDatasetAudit({
    dataset,
    timeRange: input.time_range,
    statsYearRange: input.stats_year_range,
    consumptionRange,
    sections: input.sections as McpAuditSection[] | undefined,
  });

  const okSteps = audit.steps.filter((s) => s.status === "ok").length;
  const errSteps = audit.steps.filter((s) => s.status === "error").length;
  const style = input.report_style ?? "executive";

  if (input.output_path) {
    const resolved = path.resolve(input.output_path);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    const written: string[] = [];

    if (input.output_format === "json") {
      fs.writeFileSync(resolved, JSON.stringify(audit, null, 2), "utf8");
      written.push(resolved);
    } else if (input.output_format === "docx") {
      const docxTarget = resolved.toLowerCase().endsWith(".docx")
        ? resolved
        : `${resolved}.docx`;
      await exportExecutiveDocx(audit, docxTarget);
      written.push(docxTarget);
    } else {
      const md = formatMarkdown(audit, style);
      const mdPath = resolved.toLowerCase().endsWith(".md") ? resolved : `${resolved}.md`;
      fs.writeFileSync(mdPath, md, "utf8");
      written.push(mdPath);

      if (input.export_docx !== false && style === "executive") {
        const docxPath = docxPathFromMarkdown(mdPath);
        await exportExecutiveDocx(audit, docxPath);
        written.push(docxPath);
      }
    }

    return [
      `MCP dataset audit complete for "${dataset}" (${audit.label}).`,
      `Report style: ${style} | Health: ${style === "executive" ? "see report" : "n/a"}`,
      ``,
      `Steps: ${okSteps} ok, ${errSteps} error(s), ${audit.steps.length} total`,
      `Findings: ${audit.findings.length}`,
      ``,
      `Wrote:`,
      ...written.map((f) => `  • ${f}`),
    ].join("\n");
  }

  if (input.output_format === "json") {
    return JSON.stringify(audit, null, 2);
  }

  if (input.output_format === "docx") {
    return [
      `DOCX export requires output_path. Re-run with output_path set to your .docx file.`,
      `Audit complete: ${okSteps}/${audit.steps.length} steps ok, ${audit.findings.length} findings.`,
    ].join("\n");
  }

  return formatMarkdown(audit, style);
}
