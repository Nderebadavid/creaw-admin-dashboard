import type { z } from "zod";

export const API_ROUTE_TEMPLATES = [
  "/auth/login",
  "/auth/otp/verify",
  "/auth/otp/resend",
  "/auth/refresh",
  "/auth/password/forgot",
  "/auth/password/reset",
  "/auth/logout",
  "/auth/me",
  "/dashboard",
  "/field-submissions",
  "/field-submissions/:id",
  "/pillars/:pillar",
  "/pillars/:pillar/summary",
  "/pillars/:pillar/form-options",
  "/participants",
  "/participants/:id",
  "/referrals",
  "/referrals/:id",
  "/grants",
  "/grants/:id",
  "/projects",
  "/projects/:id",
  "/donors",
  "/donors/:id",
  "/assessments",
  "/assessments/:id",
  "/reports",
  "/reports/:id",
  "/audit-logs",
  "/admin/users",
  "/admin/users/:id",
  "/admin/roles",
  "/admin/roles/:id",
  "/admin/permissions",
  "/admin/permissions/:id",
  "/admin/pipelines",
  "/admin/pipelines/:id",
  "/admin/providers",
  "/admin/providers/:id",
  "/lookups",
  "/lookups/:table",
  "/lookups/:table/:id",
] as const;

export type ApiRouteTemplate = (typeof API_ROUTE_TEMPLATES)[number];

export interface ApiRequest<TBody = undefined> {
  method: "GET" | "POST" | "PATCH";
  path: string;
  routeTemplate: ApiRouteTemplate;
  query?: Record<string, string | number | boolean | undefined>;
  body?: TBody;
  token?: string;
  correlationId: string;
}

export interface ApiTransport {
  request<T>(request: ApiRequest<unknown>, schema: z.ZodType<T>): Promise<T>;
}
