import { internalGet } from "./internal.js";

export interface IdentityType {
  id: string;
  label?: string;
  uniqueDiscriminatorType?: string;
  caseSensitive?: boolean;
}

export interface AttributeDefinition {
  name: string;
  label?: string;
  type?: string;
  systemManaged?: boolean;
  identityTypeId?: string;
  overrideClassification?: string;
}

export async function fetchIdentityTypes(): Promise<IdentityType[]> {
  return internalGet<IdentityType[]>(
    "/internal/identityTypes/",
    undefined,
    "Failed to list identity types"
  );
}

export async function fetchUserAttributeDefinitions(
  dataset: string
): Promise<AttributeDefinition[]> {
  return internalGet<AttributeDefinition[]>(
    `/internal/dataset/${dataset}/attributeDefinitions/user`,
    undefined,
    `Failed to list user attribute definitions for "${dataset}"`
  );
}

export async function fetchCatalogConfig(
  dataset: string
): Promise<Record<string, unknown>> {
  return internalGet<Record<string, unknown>>(
    `/internal/dataset/${dataset}/catalogConfig`,
    undefined,
    `Failed to fetch catalog config for "${dataset}"`
  );
}

export async function fetchIntegrationSetup(
  dataset: string
): Promise<Record<string, unknown>> {
  return internalGet<Record<string, unknown>>(
    `/internal/dataset/${dataset}/integrationSetup`,
    undefined,
    `Failed to fetch integration setup for "${dataset}"`
  );
}
