import { z } from "zod";

export const DatasetParamSchema = z
  .string()
  .min(1)
  .optional()
  .describe(
    "Dataset name. Optional if IS_DEFAULT_DATASET is set in MCP config."
  );
