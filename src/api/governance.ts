import { internalGet } from "./internal.js";

export interface PrincipalRole {
  id: string;
  dataset?: string[];
}

export interface Principal {
  principalId: string;
  accountId?: string;
  type?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  enabled?: boolean;
  twoFactorAuthEnabled?: boolean;
  roles?: PrincipalRole[];
  lastLoginDate?: number;
  lastLoginIP?: string;
  sftpDataset?: string | null;
  [key: string]: unknown;
}

export interface RoleDefinition {
  id: string;
  name: string;
  permissionCount?: number;
  isGlobal?: boolean;
  permissions?: string[];
}

export async function fetchPrincipals(): Promise<Principal[]> {
  return internalGet<Principal[]>(
    "/internal/principals/",
    undefined,
    "Failed to list principals"
  );
}

export async function fetchRoleDefinitions(): Promise<RoleDefinition[]> {
  return internalGet<RoleDefinition[]>(
    "/internal/roleDefinitions/",
    undefined,
    "Failed to list role definitions"
  );
}

export async function fetchSftpPrincipals(): Promise<Principal[]> {
  return internalGet<Principal[]>(
    "/internal/sftp/principals",
    undefined,
    "Failed to list SFTP principals"
  );
}

export function principalHasDatasetAccess(principal: Principal, dataset: string): boolean {
  const roles = principal.roles ?? [];
  return roles.some((role) => {
    const datasets = role.dataset ?? [];
    return datasets.includes("*") || datasets.includes(dataset);
  });
}

export function summarizePrincipal(principal: Principal): {
  principalId: string;
  name: string;
  email?: string;
  enabled: boolean;
  twoFactorAuthEnabled: boolean;
  roleIds: string[];
  datasetScope: string[];
  lastLoginDate?: number;
} {
  const name = [principal.firstName, principal.lastName].filter(Boolean).join(" ") || "—";
  const datasetScope = [
    ...new Set((principal.roles ?? []).flatMap((r) => r.dataset ?? [])),
  ];
  return {
    principalId: principal.principalId,
    name,
    email: principal.email,
    enabled: principal.enabled !== false,
    twoFactorAuthEnabled: principal.twoFactorAuthEnabled === true,
    roleIds: (principal.roles ?? []).map((r) => r.id),
    datasetScope,
    lastLoginDate: principal.lastLoginDate,
  };
}
