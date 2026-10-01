import "server-only";
import { API_ROUTE_TEMPLATES, type ApiRequest } from "../api/transport";
import { getEffectiveGrants } from "../auth/permissions";
import { type MockContext, type ResourceContext } from "./context";
import { envelope } from "./core";
import { resolvePermission } from "./resources/permission";
import { readResource } from "./resources/read";
import { resolveTarget } from "./resources/target";
import { writeResource } from "./resources/write";
import { handleAdminCommands } from "./routes/admin";
import { handleAuditLogs } from "./routes/audit-logs";
import { handleCurrentUser, handleSessionRoutes } from "./routes/auth";
import { handleDashboard } from "./routes/dashboard";
import { handleFacilitatorOptions } from "./routes/facilitators";
import { handleReportViews } from "./routes/reports";
import { getMockStore, resolveMockToken } from "./store";
import { type ApiEnvelope } from "@/types/api";

/**
 * In-process stand-in for the portal backend. Dispatches a request to the
 * route modules in order; each returns an envelope when it owns the route or
 * `undefined` to pass. Everything else falls through to the generic resource
 * flow: resolve the target, choose the permission, then read or write.
 */
export async function handleMockRequest(
  request: ApiRequest<unknown>
): Promise<ApiEnvelope<unknown>> {
  const store = getMockStore();
  const url = new URL(request.path, "http://mock.invalid");
  if (!request.path.startsWith("/") || url.origin !== "http://mock.invalid") return envelope(404);
  for (const [key, value] of Object.entries(request.query ?? {}))
    if (value !== undefined) url.searchParams.set(key, String(value));
  const query = url.searchParams;
  const parts = url.pathname.split("/").filter(Boolean);
  const template = API_ROUTE_TEMPLATES.find((route) =>
    new RegExp("^" + route.replace(/:[^/]+/g, "[^/]+") + "$").test(url.pathname)
  );
  if (!template || request.routeTemplate !== template) return envelope(404);
  // Login and logout run before the caller is known, so they get no user or grants.
  const session = { request, store, url, query, parts, userId: 0, grants: [] };
  const sessionResponse = handleSessionRoutes(session);
  if (sessionResponse) return sessionResponse;
  const userId = resolveMockToken(request.token) ?? 0;
  const grants = getEffectiveGrants(userId);
  if (!grants.length) return envelope(403);
  const ctx: MockContext = { ...session, userId, grants };
  const routed =
    handleCurrentUser(ctx) ??
    handleAuditLogs(ctx) ??
    handleAdminCommands(ctx) ??
    handleReportViews(ctx) ??
    handleFacilitatorOptions(ctx) ??
    handleDashboard(ctx);
  if (routed) return routed;

  const target = resolveTarget(ctx);
  if ("resultCode" in target) return target;
  const permission = resolvePermission({ ...ctx, ...target });
  if (typeof permission !== "string") return permission;
  const resource: ResourceContext = { ...ctx, ...target, permission };
  return request.method === "GET" ? readResource(resource) : writeResource(resource);
}
