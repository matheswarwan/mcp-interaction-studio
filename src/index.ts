#!/usr/bin/env node
import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./config.js";
import {
  CHECK_SESSION_TOOL,
  CheckSessionInputSchema,
  handleCheckSession,
} from "./tools/check_session.js";
import {
  LIST_DATASETS_TOOL,
  ListDatasetsInputSchema,
  handleListDatasets,
} from "./tools/list_datasets.js";
import {
  GET_DATASET_TOOL,
  GetDatasetInputSchema,
  handleGetDataset,
} from "./tools/get_dataset.js";
import {
  LIST_CAMPAIGNS_TOOL,
  ListCampaignsInputSchema,
  handleListCampaigns,
} from "./tools/list_campaigns.js";
import {
  GET_CAMPAIGN_TOOL,
  GetCampaignInputSchema,
  handleGetCampaign,
} from "./tools/get_campaign.js";
import {
  GET_CAMPAIGN_STATS_TOOL,
  GetCampaignStatsInputSchema,
  handleGetCampaignStats,
} from "./tools/get_campaign_stats.js";
import {
  LIST_SEGMENTS_TOOL,
  ListSegmentsInputSchema,
  handleListSegments,
} from "./tools/list_segments.js";
import {
  GET_SEGMENT_TOOL,
  GetSegmentInputSchema,
  handleGetSegment,
} from "./tools/get_segment.js";
import {
  LIST_ALL_SEGMENTS_TOOL,
  ListAllSegmentsInputSchema,
  handleListAllSegments,
} from "./tools/list_all_segments.js";
import {
  LIST_TEMPLATES_TOOL,
  ListTemplatesInputSchema,
  handleListTemplates,
} from "./tools/list_templates.js";
import {
  LIST_RECIPES_TOOL,
  ListRecipesInputSchema,
  handleListRecipes,
} from "./tools/list_recipes.js";
import {
  GET_CAMPAIGN_CONTEXT_TOOL,
  GetCampaignContextInputSchema,
  handleGetCampaignContext,
} from "./tools/get_campaign_context.js";
import {
  LIST_SURVEYS_TOOL,
  ListSurveysInputSchema,
  handleListSurveys,
} from "./tools/list_surveys.js";
import {
  LIST_CONTENT_ZONE_LOGS_TOOL,
  ListContentZoneLogsInputSchema,
  handleListContentZoneLogs,
} from "./tools/list_content_zone_logs.js";
import {
  GET_SEGMENT_DETAILS_TOOL,
  GetSegmentDetailsInputSchema,
  handleGetSegmentDetails,
} from "./tools/get_segment_details.js";
import {
  AUDIT_DATASET_TOOL,
  AuditDatasetInputSchema,
  handleAuditDataset,
} from "./tools/audit_dataset.js";
import {
  COMPARE_DATASETS_TOOL,
  CompareDatasetsInputSchema,
  handleCompareDatasets,
} from "./tools/compare_datasets.js";
import {
  GET_RECIPE_USAGE_TOOL,
  GetRecipeUsageInputSchema,
  handleGetRecipeUsage,
} from "./tools/get_recipe_usage.js";
import {
  LIST_SEGMENT_STATS_TOOL,
  ListSegmentStatsInputSchema,
  handleListSegmentStats,
} from "./tools/list_segment_stats.js";
import {
  SET_CAMPAIGN_STATE_TOOL,
  SetCampaignStateInputSchema,
  handleSetCampaignState,
} from "./tools/set_campaign_state.js";
import {
  SET_SEGMENT_ENABLED_TOOL,
  SetSegmentEnabledInputSchema,
  handleSetSegmentEnabled,
} from "./tools/set_segment_enabled.js";
import {
  AUDIT_MCP_DATASET_TOOL,
  AuditMcpDatasetInputSchema,
  handleAuditMcpDataset,
} from "./tools/audit_mcp_dataset.js";

loadConfig();

const TOOLS = [
  CHECK_SESSION_TOOL,
  LIST_DATASETS_TOOL,
  GET_DATASET_TOOL,
  LIST_CAMPAIGNS_TOOL,
  GET_CAMPAIGN_TOOL,
  GET_CAMPAIGN_STATS_TOOL,
  LIST_SEGMENTS_TOOL,
  GET_SEGMENT_TOOL,
  LIST_ALL_SEGMENTS_TOOL,
  LIST_TEMPLATES_TOOL,
  LIST_RECIPES_TOOL,
  GET_CAMPAIGN_CONTEXT_TOOL,
  LIST_SURVEYS_TOOL,
  LIST_CONTENT_ZONE_LOGS_TOOL,
  GET_SEGMENT_DETAILS_TOOL,
  AUDIT_DATASET_TOOL,
  COMPARE_DATASETS_TOOL,
  GET_RECIPE_USAGE_TOOL,
  LIST_SEGMENT_STATS_TOOL,
  SET_CAMPAIGN_STATE_TOOL,
  SET_SEGMENT_ENABLED_TOOL,
  AUDIT_MCP_DATASET_TOOL,
];

const server = new Server(
  { name: "mcp-interaction-studio", version: "1.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "check_session") {
      CheckSessionInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleCheckSession({}) }] };
    }

    if (name === "list_datasets") {
      ListDatasetsInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleListDatasets({}) }] };
    }

    if (name === "get_dataset") {
      const input = GetDatasetInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleGetDataset(input) }] };
    }

    if (name === "list_campaigns") {
      const input = ListCampaignsInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleListCampaigns(input) }] };
    }

    if (name === "get_campaign") {
      const input = GetCampaignInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleGetCampaign(input) }] };
    }

    if (name === "get_campaign_stats") {
      const input = GetCampaignStatsInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleGetCampaignStats(input) }] };
    }

    if (name === "list_segments") {
      const input = ListSegmentsInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleListSegments(input) }] };
    }

    if (name === "get_segment") {
      const input = GetSegmentInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleGetSegment(input) }] };
    }

    if (name === "list_all_segments") {
      const input = ListAllSegmentsInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleListAllSegments(input) }] };
    }

    if (name === "list_templates") {
      const input = ListTemplatesInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleListTemplates(input) }] };
    }

    if (name === "list_recipes") {
      const input = ListRecipesInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleListRecipes(input) }] };
    }

    if (name === "get_campaign_context") {
      const input = GetCampaignContextInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleGetCampaignContext(input) }] };
    }

    if (name === "list_surveys") {
      const input = ListSurveysInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleListSurveys(input) }] };
    }

    if (name === "list_content_zone_logs") {
      const input = ListContentZoneLogsInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleListContentZoneLogs(input) }] };
    }

    if (name === "get_segment_details") {
      const input = GetSegmentDetailsInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleGetSegmentDetails(input) }] };
    }

    if (name === "audit_dataset") {
      const input = AuditDatasetInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleAuditDataset(input) }] };
    }

    if (name === "compare_datasets") {
      const input = CompareDatasetsInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleCompareDatasets(input) }] };
    }

    if (name === "get_recipe_usage") {
      const input = GetRecipeUsageInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleGetRecipeUsage(input) }] };
    }

    if (name === "list_segment_stats") {
      const input = ListSegmentStatsInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleListSegmentStats(input) }] };
    }

    if (name === "set_campaign_state") {
      const input = SetCampaignStateInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleSetCampaignState(input) }] };
    }

    if (name === "set_segment_enabled") {
      const input = SetSegmentEnabledInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleSetSegmentEnabled(input) }] };
    }

    if (name === "audit_mcp_dataset") {
      const input = AuditMcpDatasetInputSchema.parse(args ?? {});
      return { content: [{ type: "text", text: await handleAuditMcpDataset(input) }] };
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-interaction-studio server running");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
