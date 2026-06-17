import { getConfig } from "../config.js";

export function assertWritesEnabled(): void {
  if (!getConfig().writesEnabled) {
    throw new Error(
      "Write operations are disabled. Set IS_WRITES_ENABLED=true in MCP config to enable set_campaign_state and set_segment_enabled."
    );
  }
}

export function assertConfirmed(confirm: boolean, dryRun: boolean): void {
  if (dryRun) return;
  if (!confirm) {
    throw new Error(
      "Refusing to write without confirm=true. Use dry_run=true to preview the change first."
    );
  }
}
