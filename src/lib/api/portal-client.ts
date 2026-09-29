import "server-only";
import { createApiClient } from "./client";
import { LiveApiTransport } from "./live-transport";
import { MockApiTransport } from "./mock-transport";
import { handleMockRequest } from "../mock-api/handlers";

export function createPortalApiClient() {
  const mode = process.env.PORTAL_API_MODE ?? "mock";
  if (mode === "mock") return createApiClient(new MockApiTransport(handleMockRequest));
  if (mode !== "live") throw new Error("Unknown PORTAL_API_MODE; expected mock or live");
  const baseUrl = process.env.PORTAL_API_BASE_URL;
  if (!baseUrl || !/^https?:\/\//.test(baseUrl))
    throw new Error("Live API mode requires an HTTP(S) PORTAL_API_BASE_URL");
  const timeout = Number(process.env.PORTAL_API_TIMEOUT_MS ?? 10000);
  if (!Number.isInteger(timeout) || timeout <= 0) throw new Error("Invalid PORTAL_API_TIMEOUT_MS");
  return createApiClient(new LiveApiTransport(baseUrl, timeout));
}
