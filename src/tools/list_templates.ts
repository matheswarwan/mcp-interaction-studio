import { z } from "zod";
import { fetchItemTemplates } from "../api/templates.js";
import { DatasetParamSchema } from "../types/datasetSchema.js";
import { resolveDataset } from "../utils/dataset.js";

export const ListTemplatesInputSchema = z.object({
  dataset: DatasetParamSchema,
});

export type ListTemplatesInput = z.infer<typeof ListTemplatesInputSchema>;

export const LIST_TEMPLATES_TOOL = {
  name: "list_templates",
  description:
    "List item/message templates in an Interaction Studio dataset used for campaign content.",
  inputSchema: {
    type: "object" as const,
    properties: {
      dataset: {
        type: "string",
        description: "Dataset name. Optional if IS_DEFAULT_DATASET is configured.",
      },
    },
    required: [],
  },
};

export async function handleListTemplates(input: ListTemplatesInput): Promise<string> {
  const dataset = resolveDataset(input.dataset);
  const templates = await fetchItemTemplates(dataset);

  if (templates.length === 0) {
    return `No templates found in dataset "${dataset}".`;
  }

  const lines = templates.map((t) => {
    const itemType = t.itemType?.itemType ?? "—";
    const type = t.templateType ?? "—";
    return [
      `• ${t.name} (id: ${t.id})`,
      `  state: ${t.state ?? "—"} | item type: ${itemType} | template type: ${type}`,
    ].join("\n");
  });

  return `Found ${templates.length} template(s) in "${dataset}":\n\n${lines.join("\n\n")}`;
}
