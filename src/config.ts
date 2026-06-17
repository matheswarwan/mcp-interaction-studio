import { z } from "zod";

const ConfigSchema = z.object({
  baseUrl: z
    .string()
    .url()
    .transform((url) => url.replace(/\/$/, "")),
  sessionId: z.string().min(1, "IS_SESSION_ID is required"),
  tlsInsecure: z.boolean(),
  defaultDataset: z.string().min(1).optional(),
  writesEnabled: z.boolean(),
});

export type Config = z.infer<typeof ConfigSchema>;

let _config: Config | null = null;

export function loadConfig(): Config {
  const baseUrl = process.env.IS_BASE_URL;
  const sessionId = process.env.IS_SESSION_ID;
  const tlsInsecure = process.env.IS_TLS_INSECURE === "true";
  const defaultDataset = process.env.IS_DEFAULT_DATASET?.trim() || undefined;
  const writesEnabled = process.env.IS_WRITES_ENABLED === "true";

  if (!baseUrl) {
    throw new Error("Missing IS_BASE_URL environment variable.");
  }
  if (!sessionId) {
    throw new Error(
      "Missing IS_SESSION_ID environment variable. Copy JSESSIONID from browser DevTools after logging into Interaction Studio."
    );
  }

  _config = ConfigSchema.parse({
    baseUrl,
    sessionId,
    tlsInsecure,
    defaultDataset,
    writesEnabled,
  });
  return _config;
}

export function getConfig(): Config {
  if (!_config) {
    return loadConfig();
  }
  return _config;
}
