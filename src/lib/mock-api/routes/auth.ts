import { getEffectiveGrants } from "../../auth/permissions";
import { type MockContext } from "../context";
import { envelope, masked, type Row } from "../core";
import { MOCK_PASSWORD } from "../seed";
import { issueMockToken, revokeMockToken } from "../store";
import { type ApiEnvelope } from "@/types/api";

/** Login and logout: the only routes reachable without a valid session. */
export function handleSessionRoutes(ctx: MockContext): ApiEnvelope<unknown> | undefined {
  const { request, store, url } = ctx;
  if (url.pathname === "/auth/login" && request.method === "POST") {
    const body = request.body as { username?: unknown; password?: unknown } | undefined;
    if (typeof body?.username !== "string" || typeof body?.password !== "string")
      return envelope(422);
    const user = store.user.find(
      (row) => row.username === body.username && !row.is_deleted && row.status === "ACTIVE"
    );
    if (!user || body.password !== MOCK_PASSWORD) return envelope(403);
    return envelope(200, {
      token: issueMockToken(user.id),
      user: masked("user", user as unknown as Row),
      grants: getEffectiveGrants(user.id),
    });
  }
  if (url.pathname === "/auth/logout") {
    if (request.method !== "POST") return envelope(422);
    if (!request.token || !revokeMockToken(request.token)) return envelope(403);
    return envelope(200);
  }
  return undefined;
}

/** `GET /auth/me`: the signed-in user and their effective grants. */
export function handleCurrentUser(ctx: MockContext): ApiEnvelope<unknown> | undefined {
  const { request, store, url, userId, grants } = ctx;
  if (url.pathname === "/auth/me")
    return request.method === "GET"
      ? envelope(200, {
          user: masked("user", store.user.find((row) => row.id === userId)! as unknown as Row),
          grants,
          roles: activeRoleNames(store, userId),
        })
      : envelope(422);
  return undefined;
}

/** Distinct names of the user's active, non-deleted role assignments. */
function activeRoleNames(store: MockContext["store"], userId: number): string[] {
  const live = (row: { is_deleted: boolean; status: string }) =>
    !row.is_deleted && row.status === "ACTIVE";
  const roleIds = store.user_role
    .filter((row) => row.user_id === userId && live(row))
    .map((row) => row.role_id);
  return [
    ...new Set(
      store.role.filter((role) => roleIds.includes(role.id) && live(role)).map((role) => role.name)
    ),
  ];
}
