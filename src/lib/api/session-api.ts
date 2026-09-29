import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import type { ApiClient } from "./client";
import { createPortalApiClient } from "./portal-client";

/** The signed-in user's API token, or `undefined` when there is no session cookie. */
export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value;
}

/**
 * Builds a feature API bound to the current user's session.
 *
 * Every feature exposes a `createXApi(client, token)` factory so tests can inject
 * a client directly; pages and Server Actions call through here instead so the
 * cookie lookup and transport selection live in one place.
 */
export async function withSessionApi<T>(
  factory: (client: ApiClient, token: string) => T
): Promise<T> {
  const token = await readSessionToken();
  if (!token) throw new Error("Sign in required");
  return factory(createPortalApiClient(), token);
}
