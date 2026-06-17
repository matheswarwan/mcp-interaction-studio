import {
  AccountLimits,
  ConsumptionTimeRange,
  defaultConsumptionRange,
  fetchAccountLimits,
  fetchConsumptionCampaignStats,
  fetchEtlStats,
  fetchEventStats,
  fetchMuvStats,
  fetchSegmentExportStats,
  fetchTriggeredCampaignStats,
  fetchVisitorsConsumption,
  VisitorsConsumption,
  ConsumptionSeries,
  EventStatsConsumption,
  EtlStatsConsumption,
  TriggeredCampaignStatsConsumption,
} from "../api/consumption.js";
import {
  fetchCatalogConfig,
  fetchIdentityTypes,
  fetchIntegrationSetup,
  fetchUserAttributeDefinitions,
  AttributeDefinition,
  IdentityType,
} from "../api/datasetSettings.js";
import {
  fetchPrincipals,
  fetchRoleDefinitions,
  fetchSftpPrincipals,
  principalHasDatasetAccess,
  Principal,
  RoleDefinition,
  summarizePrincipal,
} from "../api/governance.js";
import { buildDatasetAudit, DatasetAudit, AuditFinding } from "./buildAudit.js";
import {
  buildDatasetConsumptionSummary,
  DatasetConsumptionSummary,
} from "./consumptionSummary.js";

export type McpAuditSection = "governance" | "consumption" | "settings";

export const MCP_AUDIT_SECTIONS: McpAuditSection[] = [
  "governance",
  "consumption",
  "settings",
];

export interface AuditStepResult {
  step: string;
  status: "ok" | "skipped" | "error";
  durationMs: number;
  error?: string;
}

export interface GovernanceAudit {
  totalUsers: number;
  enabledUsers: number;
  adminUsers: number;
  usersWithout2fa: number;
  datasetUserCount: number;
  users: ReturnType<typeof summarizePrincipal>[];
  datasetUsers: ReturnType<typeof summarizePrincipal>[];
  roles: Array<Pick<RoleDefinition, "id" | "name" | "permissionCount">>;
  sftpPrincipals: Array<{
    principalId: string;
    description?: string;
    sftpDataset?: string | null;
    enabled: boolean;
  }>;
}

export interface ConsumptionAudit {
  range: ConsumptionTimeRange;
  limits: AccountLimits;
  dataset: DatasetConsumptionSummary;
  accountMuvTotal: number;
}

export interface DatasetSettingsAudit {
  integrationSetup: Record<string, unknown>;
  catalogConfigSummary: {
    locale?: string;
    currency?: string;
    localizationEnabled?: boolean;
    itemTypes: string[];
  };
  identityTypes: IdentityType[];
  userAttributes: AttributeDefinition[];
  piiAttributeCount: number;
}

export interface McpDatasetAudit extends DatasetAudit {
  auditType: "mcp_dataset";
  sections: McpAuditSection[];
  steps: AuditStepResult[];
  governance?: GovernanceAudit;
  consumption?: ConsumptionAudit;
  datasetSettings?: DatasetSettingsAudit;
  extendedFindings: AuditFinding[];
}

export interface BuildMcpDatasetAuditOptions {
  dataset: string;
  timeRange?: string;
  statsYearRange?: string;
  consumptionRange?: ConsumptionTimeRange;
  sections?: McpAuditSection[];
}

async function runStep<T>(
  step: string,
  fn: () => Promise<T>
): Promise<{ stepResult: AuditStepResult; value?: T }> {
  const started = Date.now();
  try {
    const value = await fn();
    return {
      stepResult: { step: step, status: "ok", durationMs: Date.now() - started },
      value,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      stepResult: {
        step,
        status: "error",
        durationMs: Date.now() - started,
        error: message,
      },
    };
  }
}

function buildGovernanceAudit(
  dataset: string,
  principals: Principal[],
  roles: RoleDefinition[],
  sftp: Principal[]
): GovernanceAudit {
  const userPrincipals = principals.filter((p) => p.type === "USER");
  const users = userPrincipals.map(summarizePrincipal);
  const datasetUsers = userPrincipals
    .filter((p) => principalHasDatasetAccess(p, dataset))
    .map(summarizePrincipal);

  return {
    totalUsers: users.length,
    enabledUsers: users.filter((u) => u.enabled).length,
    adminUsers: users.filter((u) => u.roleIds.some((r) => r.includes("admin"))).length,
    usersWithout2fa: users.filter((u) => u.enabled && !u.twoFactorAuthEnabled).length,
    datasetUserCount: datasetUsers.length,
    users,
    datasetUsers,
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      permissionCount: r.permissionCount,
    })),
    sftpPrincipals: sftp.map((p) => ({
      principalId: p.principalId,
      description: typeof p.description === "string" ? p.description : undefined,
      sftpDataset: p.sftpDataset,
      enabled: p.enabled !== false,
    })),
  };
}

function buildSettingsAudit(
  integrationSetup: Record<string, unknown>,
  catalogConfig: Record<string, unknown>,
  identityTypes: IdentityType[],
  userAttributes: AttributeDefinition[]
): DatasetSettingsAudit {
  const itemTypes = Array.isArray(catalogConfig.catalogItemTypes)
    ? (catalogConfig.catalogItemTypes as Array<{ name?: string; enabled?: boolean }>)
        .filter((t) => t.enabled !== false)
        .map((t) => t.name ?? "—")
    : [];

  const piiAttributeCount = userAttributes.filter(
    (a) => a.overrideClassification === "PersonallyIdentifiable"
  ).length;

  return {
    integrationSetup,
    catalogConfigSummary: {
      locale: typeof catalogConfig.locale === "string" ? catalogConfig.locale : undefined,
      currency: typeof catalogConfig.currency === "string" ? catalogConfig.currency : undefined,
      localizationEnabled: catalogConfig.localizationEnabled === true,
      itemTypes,
    },
    identityTypes,
    userAttributes,
    piiAttributeCount,
  };
}

function buildExtendedFindings(audit: McpDatasetAudit): AuditFinding[] {
  const findings: AuditFinding[] = [];

  if (audit.governance) {
    if (audit.governance.usersWithout2fa > 0) {
      findings.push({
        severity: "medium",
        finding: `${audit.governance.usersWithout2fa} enabled user(s) without two-factor authentication`,
        recommendation: "Enable 2FA for admin and editor accounts",
      });
    }
    const datasetSftp = audit.governance.sftpPrincipals.filter(
      (p) => p.sftpDataset === audit.dataset && p.enabled
    );
    if (datasetSftp.length > 0) {
      findings.push({
        severity: "low",
        finding: `${datasetSftp.length} SFTP principal(s) bound to this dataset`,
        recommendation: "Review SFTP credentials and rotate if stale",
      });
    }
  }

  if (audit.consumption) {
    const { limits, dataset: usage } = audit.consumption;
    if (limits.muv && usage.muvLatestMonth > limits.muv) {
      findings.push({
        severity: "high",
        finding: `Dataset MUV (${usage.muvLatestMonth}) exceeds account limit (${limits.muv}) in latest month`,
        recommendation: "Review traffic sources and contract limits with Salesforce",
      });
    }
    if (usage.eventErrors > 0) {
      findings.push({
        severity: "medium",
        finding: `${usage.eventErrors} event error(s) recorded for this dataset in consumption window`,
        recommendation: "Investigate beacon/tagging errors in event pipeline",
      });
    }
    if (usage.muvTotal === 0 && usage.events === 0) {
      findings.push({
        severity: "medium",
        finding: "No MUV or events recorded for this dataset in consumption window",
        recommendation: "Verify beacon deployment and dataset tagging",
      });
    }
  }

  if (audit.datasetSettings) {
    if (audit.datasetSettings.piiAttributeCount > 0) {
      findings.push({
        severity: "low",
        finding: `${audit.datasetSettings.piiAttributeCount} user attribute(s) classified as PII`,
        recommendation: "Confirm data handling policies for PII attributes",
      });
    }
    const setup = audit.datasetSettings.integrationSetup;
    if (setup.trackAnonymousVisitors === false) {
      findings.push({
        severity: "medium",
        finding: "Anonymous visitor tracking is disabled in integration setup",
        recommendation: "Enable trackAnonymousVisitors if web personalization is required",
      });
    }
    if (setup.c360aIntegrationEnabled === false) {
      findings.push({
        severity: "low",
        finding: "Customer 360 Audiences (C360A) integration is not enabled",
        recommendation:
          "Evaluate C360A activation if unified profiles across Data Cloud and Personalization are strategic goals",
      });
    }
  }

  const allAdmin = audit.governance?.users.every((u) =>
    u.roleIds.some((r) => r.includes("admin"))
  );
  if (allAdmin && (audit.governance?.totalUsers ?? 0) > 3) {
    findings.push({
      severity: "medium",
      finding: "All platform users hold account-administrator roles",
      recommendation:
        "Introduce Editor and Viewer roles to enforce least-privilege access aligned with job function",
    });
  }

  return findings;
}

export async function buildMcpDatasetAudit(
  options: BuildMcpDatasetAuditOptions
): Promise<McpDatasetAudit> {
  const dataset = options.dataset;
  const sections = options.sections ?? MCP_AUDIT_SECTIONS;
  const consumptionRange = options.consumptionRange ?? defaultConsumptionRange();
  const steps: AuditStepResult[] = [];

  const baseStep = await runStep("dataset_audit", () =>
    buildDatasetAudit({
      dataset,
      timeRange: options.timeRange,
      statsYearRange: options.statsYearRange,
    })
  );
  steps.push(baseStep.stepResult);
  if (!baseStep.value) {
    throw new Error(baseStep.stepResult.error ?? "Dataset audit failed");
  }
  const baseAudit = baseStep.value;

  let governance: GovernanceAudit | undefined;
  if (sections.includes("governance")) {
    const principalsStep = await runStep("governance_principals", fetchPrincipals);
    steps.push(principalsStep.stepResult);

    const rolesStep = await runStep("governance_roles", fetchRoleDefinitions);
    steps.push(rolesStep.stepResult);

    const sftpStep = await runStep("governance_sftp", fetchSftpPrincipals);
    steps.push(sftpStep.stepResult);

    if (principalsStep.value && rolesStep.value && sftpStep.value) {
      governance = buildGovernanceAudit(
        dataset,
        principalsStep.value,
        rolesStep.value,
        sftpStep.value
      );
    }
  }

  let consumption: ConsumptionAudit | undefined;
  if (sections.includes("consumption")) {
    const limitsStep = await runStep("consumption_limits", fetchAccountLimits);
    steps.push(limitsStep.stepResult);

    let visitors: VisitorsConsumption | undefined;
    let muvStats: ConsumptionSeries | undefined;
    let segmentExportStats: ConsumptionSeries | undefined;
    let campaignStats: ConsumptionSeries | undefined;
    let eventStats: EventStatsConsumption | undefined;
    let etlStats: EtlStatsConsumption | undefined;
    let triggeredStats: TriggeredCampaignStatsConsumption | undefined;

    const rangedSteps: Array<{
      name: string;
      run: () => Promise<unknown>;
      assign: (v: unknown) => void;
    }> = [
      {
        name: "consumption_visitors",
        run: () => fetchVisitorsConsumption(consumptionRange),
        assign: (v) => {
          visitors = v as VisitorsConsumption;
        },
      },
      {
        name: "consumption_muvStats",
        run: () => fetchMuvStats(consumptionRange),
        assign: (v) => {
          muvStats = v as ConsumptionSeries;
        },
      },
      {
        name: "consumption_segmentExportStats",
        run: () => fetchSegmentExportStats(consumptionRange),
        assign: (v) => {
          segmentExportStats = v as ConsumptionSeries;
        },
      },
      {
        name: "consumption_campaignStats",
        run: () => fetchConsumptionCampaignStats(consumptionRange),
        assign: (v) => {
          campaignStats = v as ConsumptionSeries;
        },
      },
      {
        name: "consumption_eventStats",
        run: () => fetchEventStats(consumptionRange),
        assign: (v) => {
          eventStats = v as EventStatsConsumption;
        },
      },
      {
        name: "consumption_etlStats",
        run: () => fetchEtlStats(consumptionRange),
        assign: (v) => {
          etlStats = v as EtlStatsConsumption;
        },
      },
      {
        name: "consumption_triggeredCampaignStats",
        run: () => fetchTriggeredCampaignStats(consumptionRange),
        assign: (v) => {
          triggeredStats = v as TriggeredCampaignStatsConsumption;
        },
      },
    ];

    for (const ranged of rangedSteps) {
      const result = await runStep(ranged.name, ranged.run);
      steps.push(result.stepResult);
      if (result.value !== undefined) ranged.assign(result.value);
    }

    if (limitsStep.value) {
      const datasetSummary = buildDatasetConsumptionSummary(dataset, {
        muvStats,
        visitors,
        segmentExportStats,
        campaignStats,
        eventStats,
        etlStats,
        triggeredCampaignStats: triggeredStats,
      });
      const accountMuvTotal = (muvStats?.total ?? []).reduce((s, p) => s + p.value, 0);

      consumption = {
        range: consumptionRange,
        limits: limitsStep.value,
        dataset: datasetSummary,
        accountMuvTotal,
      };
    }
  }

  let datasetSettings: DatasetSettingsAudit | undefined;
  if (sections.includes("settings")) {
    const integrationStep = await runStep("settings_integrationSetup", () =>
      fetchIntegrationSetup(dataset)
    );
    steps.push(integrationStep.stepResult);

    const catalogStep = await runStep("settings_catalogConfig", () =>
      fetchCatalogConfig(dataset)
    );
    steps.push(catalogStep.stepResult);

    const identityStep = await runStep("settings_identityTypes", fetchIdentityTypes);
    steps.push(identityStep.stepResult);

    const attributesStep = await runStep("settings_userAttributes", () =>
      fetchUserAttributeDefinitions(dataset)
    );
    steps.push(attributesStep.stepResult);

    if (integrationStep.value && catalogStep.value && identityStep.value && attributesStep.value) {
      datasetSettings = buildSettingsAudit(
        integrationStep.value,
        catalogStep.value,
        identityStep.value,
        attributesStep.value
      );
    }
  }

  const partial: McpDatasetAudit = {
    ...baseAudit,
    auditType: "mcp_dataset",
    sections,
    steps,
    governance,
    consumption,
    datasetSettings,
    extendedFindings: [],
  };

  partial.extendedFindings = buildExtendedFindings(partial);
  partial.findings = [...partial.findings, ...partial.extendedFindings];

  return partial;
}
