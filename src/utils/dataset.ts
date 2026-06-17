import { getConfig } from "../config.js";

export function resolveDataset(dataset?: string): string {
  const resolved = dataset?.trim() || getConfig().defaultDataset;
  if (!resolved) {
    throw new Error(
      "dataset is required. Pass it as a tool parameter or set IS_DEFAULT_DATASET in your MCP config."
    );
  }
  return resolved;
}
