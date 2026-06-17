import * as fs from "node:fs";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { McpDatasetAudit } from "./buildMcpDatasetAudit.js";
import {
  ExecutiveNarrative,
  StrategicRecommendation,
  synthesizeExecutiveNarrative,
} from "./synthesizeExecutiveNarrative.js";

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({ text, heading: level, spacing: { after: 120 } });
}

function body(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text })],
    spacing: { after: 100 },
  });
}

function bullets(items: string[]): Paragraph[] {
  return items.map(
    (item) =>
      new Paragraph({
        text: item.replace(/\*\*/g, ""),
        bullet: { level: 0 },
        spacing: { after: 60 },
      })
  );
}

function priorityLabel(p: StrategicRecommendation["priority"]): string {
  if (p === "immediate") return "Immediate (0–30 days)";
  if (p === "short_term") return "Short term (30–90 days)";
  return "Medium term (90+ days)";
}

function tableFromRows(rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (cells, rowIndex) =>
        new TableRow({
          children: cells.map(
            (cell) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cell,
                        bold: rowIndex === 0,
                      }),
                    ],
                  }),
                ],
              })
          ),
        })
    ),
  });
}

export async function exportExecutiveDocx(
  audit: McpDatasetAudit,
  outputPath: string,
  narrative?: ExecutiveNarrative
): Promise<void> {
  const n = narrative ?? synthesizeExecutiveNarrative(audit);
  const generated = audit.generatedAt.slice(0, 10);
  const published = audit.campaigns.filter((c) => c.state === "Published").length;

  const children: (Paragraph | Table)[] = [
    heading("Salesforce Personalization Platform Assessment", HeadingLevel.TITLE),
    heading(`${audit.label} (${audit.dataset})`, HeadingLevel.HEADING_1),
    body(`Assessment date: ${generated}`),
    body(`Instance: ${audit.instanceUrl}`),
    body(`Overall health: ${n.healthRating} (${n.healthScore}/100)`),
    heading("1. Executive Summary", HeadingLevel.HEADING_1),
    body(n.executiveSummary.replace(/\*\*/g, "")),
    heading("At a glance", HeadingLevel.HEADING_2),
    tableFromRows([
      ["Indicator", "Value"],
      ...n.atAGlance.map((r) => [r.label, r.value]),
    ]),
    heading("2. Instance Overview", HeadingLevel.HEADING_1),
    body(n.instanceStory.replace(/\*\*/g, "")),
    heading("3. Assessment Summary", HeadingLevel.HEADING_1),
    heading("What is working well", HeadingLevel.HEADING_2),
    ...bullets(n.workingWell.map((t) => t.replace(/\*\*/g, ""))),
    heading("What needs attention", HeadingLevel.HEADING_2),
    ...bullets(
      n.needsAttention.length
        ? n.needsAttention.map((t) => t.replace(/\*\*/g, ""))
        : ["None identified."]
    ),
    heading("Critical gaps and risks", HeadingLevel.HEADING_2),
    ...bullets(
      n.criticalGaps.length
        ? n.criticalGaps.map((t) => t.replace(/\*\*/g, ""))
        : ["No critical gaps identified."]
    ),
    heading("4. Strategic Recommendations", HeadingLevel.HEADING_1),
    tableFromRows([
      ["Priority", "Recommendation", "Rationale"],
      ...n.strategicRecommendations.map((r) => [
        priorityLabel(r.priority),
        r.title,
        r.rationale,
      ]),
    ]),
    heading("5. Domain Assessments", HeadingLevel.HEADING_1),
  ];

  for (const domain of n.domainAssessments) {
    children.push(
      heading(domain.domain, HeadingLevel.HEADING_2),
      body(`Rating: ${domain.rating}. ${domain.summary}`),
      heading("Strengths", HeadingLevel.HEADING_3),
      ...bullets(domain.strengths.length ? domain.strengths : ["None listed."]),
      heading("Concerns", HeadingLevel.HEADING_3),
      ...bullets(domain.concerns.length ? domain.concerns : ["None significant."]),
      heading("Recommendations", HeadingLevel.HEADING_3),
      ...bullets(domain.recommendations)
    );
  }

  children.push(
    heading("6. Risk Register", HeadingLevel.HEADING_1),
    tableFromRows([
      ["Severity", "Finding", "Recommendation"],
      ...n.prioritizedFindings.map((f) => [
        f.severity.toUpperCase(),
        f.finding,
        f.recommendation,
      ]),
    ]),
    heading("7. Technical Appendix", HeadingLevel.HEADING_1),
    body(
      `Campaigns: ${published} published, ${audit.campaigns.length - published} disabled, ${audit.campaigns.length} total. Segments: ${audit.segments.length}.`
    )
  );

  if (audit.governance) {
    children.push(
      heading("Governance — users with dataset access", HeadingLevel.HEADING_2),
      tableFromRows([
        ["User", "Role", "Last login"],
        ...audit.governance.datasetUsers.map((u) => [
          u.name,
          u.roleIds.join(", "),
          u.lastLoginDate
            ? new Date(u.lastLoginDate).toISOString().slice(0, 10)
            : "—",
        ]),
      ])
    );
  }

  if (audit.consumption) {
    children.push(
      heading("Consumption summary", HeadingLevel.HEADING_2),
      body(
        `MUV cap: ${audit.consumption.limits.muv ?? "—"}. Dataset MUV: ${audit.consumption.dataset.muvTotal}. Events: ${audit.consumption.dataset.events}.`
      )
    );
  }

  children.push(
    heading("Methodology", HeadingLevel.HEADING_1),
    body(
      "Generated by audit_mcp_dataset via Salesforce Personalization admin APIs. Point-in-time assessment for executive review; validate before contractual decisions."
    )
  );

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
}

export function docxPathFromMarkdown(mdPath: string): string {
  return mdPath.replace(/\.md$/i, ".docx");
}
