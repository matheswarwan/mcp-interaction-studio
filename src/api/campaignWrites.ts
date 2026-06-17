import { fetchCampaign, CampaignDetail } from "./campaigns.js";
import { internalPut } from "./internal.js";

export const CAMPAIGN_STATES = ["Published", "Disabled"] as const;
export type CampaignState = (typeof CAMPAIGN_STATES)[number];

export function isCampaignState(value: string): value is CampaignState {
  return (CAMPAIGN_STATES as readonly string[]).includes(value);
}

const READ_ONLY_CAMPAIGN_FIELDS = [
  "updatedBy",
  "lastPublished",
  "updatedDate",
] as const;

function isEmptyApplicationsRule(rule: Record<string, unknown>): boolean {
  const key = rule.gearComponentKey as { componentClassName?: string } | undefined;
  if (key?.componentClassName !== "EventApplicationRule") return false;
  const config = rule.configuration as { applications?: unknown[] } | undefined;
  return !config?.applications?.length;
}

function cleanRules(rules: unknown): unknown[] | undefined {
  if (!Array.isArray(rules)) return undefined;
  return rules.filter((rule) => !isEmptyApplicationsRule(rule as Record<string, unknown>));
}

export function prepareCampaignPayloadForWrite(
  campaign: CampaignDetail,
  state: CampaignState
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    ...(campaign as Record<string, unknown>),
    state,
  };

  for (const field of READ_ONLY_CAMPAIGN_FIELDS) {
    delete payload[field];
  }

  const rules = cleanRules(payload.rules);
  if (rules) payload.rules = rules;

  const experiences = payload.experiences;
  if (Array.isArray(experiences)) {
    payload.experiences = experiences.map((experience) => {
      const exp = { ...(experience as Record<string, unknown>) };
      const expRules = cleanRules(exp.rules);
      if (expRules) exp.rules = expRules;
      return exp;
    });
  }

  return payload;
}

export async function setCampaignState(
  dataset: string,
  campaignId: string,
  state: CampaignState
): Promise<{ previousState?: string; newState: CampaignState; campaign: CampaignDetail }> {
  const campaign = await fetchCampaign(dataset, campaignId);
  const previousState = campaign.state;

  if (previousState === state) {
    return { previousState, newState: state, campaign };
  }

  const payload = prepareCampaignPayloadForWrite(campaign, state);

  await internalPut<string | undefined>(
    `/internal/dataset/${dataset}/campaign/${campaignId}/`,
    payload,
    `Failed to set campaign "${campaignId}" state to "${state}" in "${dataset}"`
  );

  const updated = await fetchCampaign(dataset, campaignId);
  return { previousState, newState: state, campaign: updated };
}
