import { z } from "zod";
import {
  CAMPAIGN_STATES,
  isCampaignState,
  setCampaignState,
} from "../api/campaignWrites.js";
import { fetchCampaign } from "../api/campaigns.js";
import { DatasetParamSchema } from "../types/datasetSchema.js";
import { resolveDataset } from "../utils/dataset.js";
import { assertConfirmed, assertWritesEnabled } from "../utils/writes.js";

export const SetCampaignStateInputSchema = z.object({
  dataset: DatasetParamSchema,
  campaign_id: z.string().min(1),
  state: z.enum(CAMPAIGN_STATES),
  dry_run: z.boolean().optional().default(true),
  confirm: z.boolean().optional().default(false),
});

export type SetCampaignStateInput = z.infer<typeof SetCampaignStateInputSchema>;

export const SET_CAMPAIGN_STATE_TOOL = {
  name: "set_campaign_state",
  description:
    "Publish or disable an Interaction Studio campaign by updating its state (Published or Disabled). Requires IS_WRITES_ENABLED=true and confirm=true. Defaults to dry_run preview.",
  inputSchema: {
    type: "object" as const,
    properties: {
      dataset: {
        type: "string",
        description: "Dataset name. Optional if IS_DEFAULT_DATASET is configured.",
      },
      campaign_id: { type: "string", description: "Campaign id from list_campaigns" },
      state: {
        type: "string",
        enum: [...CAMPAIGN_STATES],
        description: "Target campaign state",
      },
      dry_run: {
        type: "boolean",
        description: "Preview only, no write (default: true)",
      },
      confirm: {
        type: "boolean",
        description: "Required to execute when dry_run=false (default: false)",
      },
    },
    required: ["campaign_id", "state"],
  },
};

export async function handleSetCampaignState(
  input: SetCampaignStateInput
): Promise<string> {
  const dataset = resolveDataset(input.dataset);
  const state = input.state;

  if (!isCampaignState(state)) {
    throw new Error(`Invalid state "${state}". Use Published or Disabled.`);
  }

  const campaign = await fetchCampaign(dataset, input.campaign_id);
  const currentState = campaign.state ?? "—";

  const dryRun = input.dry_run ?? true;
  const confirm = input.confirm ?? false;

  if (dryRun) {
    return [
      `Dry run: set campaign state`,
      `Dataset: ${dataset}`,
      `Campaign: ${campaign.name} (${input.campaign_id})`,
      `Current state: ${currentState}`,
      `Target state: ${state}`,
      currentState === state
        ? "No change needed."
        : "To apply: set dry_run=false and confirm=true (requires IS_WRITES_ENABLED=true).",
    ].join("\n");
  }

  assertConfirmed(confirm, dryRun);
  assertWritesEnabled();

  const result = await setCampaignState(dataset, input.campaign_id, state);

  return [
    `Campaign state updated in "${dataset}".`,
    `Campaign: ${result.campaign.name} (${input.campaign_id})`,
    `Previous state: ${result.previousState ?? "—"}`,
    `New state: ${result.newState}`,
  ].join("\n");
}
