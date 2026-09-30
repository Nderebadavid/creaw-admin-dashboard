import "server-only";
import { z } from "zod";
import { createPortalApiClient } from "@/lib/api/portal-client";
import type { ApiRouteTemplate } from "@/lib/api/transport";

export interface AuthActionResult {
  success: boolean;
  error?: string;
}

const authEnvelope = z.object({
  resultCode: z.number(),
  success: z.boolean(),
  message: z.string(),
  data: z.unknown(),
});
export type AuthEnvelope = z.infer<typeof authEnvelope>;

export const SERVICE_UNREACHABLE: AuthActionResult = {
  success: false,
  error: "Could not reach the authentication service. Please try again.",
};

/** POSTs to an auth route. Throws when the service cannot be reached or answers off-contract. */
export function postAuth(
  path: ApiRouteTemplate,
  body?: Record<string, unknown>,
  token?: string
): Promise<AuthEnvelope> {
  return createPortalApiClient().request(
    { method: "POST", path, routeTemplate: path, body, token },
    authEnvelope
  );
}
