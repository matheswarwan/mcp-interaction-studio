import { AxiosResponse } from "axios";
import { getISClient } from "./client.js";

export function assertOk<T>(response: AxiosResponse<T>, action: string): T {
  if (response.status === 401) {
    throw new Error(
      "Session expired or invalid (401). Log into Interaction Studio, copy a fresh JSESSIONID from DevTools, and update IS_SESSION_ID."
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (response.status !== 200) {
    throw new Error(`${action}: HTTP ${response.status} ${JSON.stringify(response.data)}`);
  }

  return response.data;
}

export function assertWriteOk<T>(response: AxiosResponse<T>, action: string): T {
  if (response.status === 401) {
    throw new Error(
      "Session expired or invalid (401). Log into Interaction Studio, copy a fresh JSESSIONID from DevTools, and update IS_SESSION_ID."
    );
  }

  if (response.status === 204 || response.status === 200) {
    return response.data;
  }

  const detail =
    typeof response.data === "string"
      ? response.data
      : JSON.stringify(response.data);
  throw new Error(`${action}: HTTP ${response.status} ${detail}`);
}

export async function internalGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  action?: string
): Promise<T> {
  const client = getISClient();
  const response = await client.get<T>(path, { params });
  return assertOk(response, action ?? `GET ${path}`);
}

export async function internalPut<T>(
  path: string,
  body: unknown,
  action?: string
): Promise<T> {
  const client = getISClient();
  const response = await client.put<T>(path, body);
  return assertWriteOk(response, action ?? `PUT ${path}`);
}

export async function internalPost<T>(
  path: string,
  body: unknown,
  params?: Record<string, string | number | boolean | undefined>,
  action?: string
): Promise<T> {
  const client = getISClient();
  const response = await client.post<T>(path, body, { params });
  return assertWriteOk(response, action ?? `POST ${path}`);
}
