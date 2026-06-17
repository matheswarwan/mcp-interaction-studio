import { z } from "zod";
import { checkSession } from "../api/session.js";

export const CheckSessionInputSchema = z.object({});

export type CheckSessionInput = z.infer<typeof CheckSessionInputSchema>;

export const CHECK_SESSION_TOOL = {
  name: "check_session",
  description:
    "Validate the Interaction Studio session (JSESSIONID) and list available datasets. " +
    "Use this first when other tools return 401 errors.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export async function handleCheckSession(_input: CheckSessionInput): Promise<string> {
  const status = await checkSession();

  const lines = [
    "Session is valid.",
    `Base URL: ${status.baseUrl}`,
    `Datasets: ${status.datasetCount}`,
  ];

  if (status.defaultDataset) {
    lines.push(`Default dataset (IS_DEFAULT_DATASET): ${status.defaultDataset}`);
  }

  lines.push("", "Available datasets:");
  for (const ds of status.datasets) {
    lines.push(`  • ${ds.label} (name: ${ds.name}) — ${ds.state}`);
  }

  return lines.join("\n");
}
