import { z } from "zod";

export const TimeRangeSchema = z
  .enum(["pastDay", "pastWeek", "pastMonth", "pastQuarter", "Today"])
  .default("pastWeek")
  .describe(
    "Stats window for campaign summaries. Also accepts custom ranges as YYYY-MM-DD..YYYY-MM-DD."
  );

export type TimeRange = z.infer<typeof TimeRangeSchema>;

export const DatasetNameSchema = z
  .string()
  .min(1)
  .describe("Dataset name, e.g. mathes or mcpdemo");
