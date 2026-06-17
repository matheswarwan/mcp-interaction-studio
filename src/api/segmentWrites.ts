import { fetchSegment, SegmentDetail } from "./segments.js";
import { internalPost } from "./internal.js";

export async function setSegmentEnabled(
  dataset: string,
  segmentId: string,
  enabled: boolean
): Promise<{ previousDisabled?: boolean; enabled: boolean; segment: SegmentDetail }> {
  const segment = await fetchSegment(dataset, segmentId);
  const extra = segment as Record<string, unknown>;
  const previousDisabled = extra.disabled === true;

  if (previousDisabled === !enabled) {
    return { previousDisabled, enabled, segment };
  }

  await internalPost<void>(
    `/internal/dataset/${dataset}/segments/disableOrEnable/`,
    {},
    { segmentIds: segmentId, disabled: !enabled },
    `Failed to ${enabled ? "enable" : "disable"} segment "${segmentId}" in "${dataset}"`
  );

  const updated = await fetchSegment(dataset, segmentId);
  const updatedExtra = updated as Record<string, unknown>;
  return {
    previousDisabled,
    enabled: updatedExtra.disabled !== true,
    segment: updated,
  };
}
