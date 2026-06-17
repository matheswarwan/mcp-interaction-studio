import https from "https";
import axios, { AxiosInstance } from "axios";
import { loadConfig } from "../config.js";

let _client: AxiosInstance | null = null;

export function getISClient(): AxiosInstance {
  if (_client) return _client;

  const config = loadConfig();
  const httpsAgent = new https.Agent({
    rejectUnauthorized: !config.tlsInsecure,
  });

  _client = axios.create({
    baseURL: config.baseUrl,
    httpsAgent,
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      Cookie: `JSESSIONID=${config.sessionId}`,
      "X-Requested-With": "XMLHttpRequest",
    },
    validateStatus: (status) => status < 500,
  });

  return _client;
}

export function resetISClient(): void {
  _client = null;
}
