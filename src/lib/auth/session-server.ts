import "server-only";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  toSessionUser,
  unwrapEnvelope,
  type IdentityServiceEnvelope,
  type SessionUser,
  type UserProfilePayload,
} from "./session";

export type { SessionUser };

/**
 * Server-side only: resolves the signed-in user from the session cookie via
 * GET /users/me (open to any authenticated user -- see
 * vsla-identity-service/docs/api-testing/README.md). Returns null if there's
 * no cookie or the identity service rejects it (expired/revoked token) --
 * callers (the dashboard layout) should redirect to /login in that case.
 *
 * proxy.ts already checked /auth/validate before this ever renders, so a
 * null here means the token expired in the few hundred ms since, or the
 * service is unreachable -- rare, but handled rather than assumed away.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const baseUrl = process.env.IDENTITY_SERVICE_BASE_URL;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token || !baseUrl) return null;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[session-server] failed to reach identity service:", err);
    return null;
  }

  if (!res.ok) return null;

  const data: IdentityServiceEnvelope<UserProfilePayload> | null = await res
    .json()
    .catch(() => null);

  const payload = unwrapEnvelope(data);
  if (!data?.success || !payload) return null;
  return toSessionUser(payload);
}
