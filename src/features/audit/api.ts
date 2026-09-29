import { cookies } from "next/headers";
import type { ApiClient } from "@/lib/api/client";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import {
  auditDetailSchema,
  auditExportSchema,
  auditListSchema,
  auditQuerySchema,
  type AuditQuery,
} from "./schemas";
import type { z } from "zod";

export type AuditRow = NonNullable<z.infer<typeof auditDetailSchema>["data"]>;
export type AuditPage = NonNullable<z.infer<typeof auditListSchema>["data"]>;
function required<T>(response: { success: boolean; data: T | null; message: string }): T {
  if (!response.success || response.data === null) throw new Error(response.message);
  return response.data;
}
export function createAuditApi(client: ApiClient, token: string) {
  const queryParams = (query: AuditQuery = {}) => {
    const parsed = auditQuerySchema.parse(query);
    return {
      page: parsed.page,
      pageSize: parsed.pageSize,
      source: parsed.source,
      module: parsed.module,
      action: parsed.action,
      targetId: parsed.targetId,
      performed_by: parsed.userId,
      from: parsed.from,
      to: parsed.to,
      search: parsed.search,
    };
  };
  return {
    async list(query: AuditQuery = {}): Promise<AuditPage> {
      return required(
        await client.request(
          {
            method: "GET",
            path: "/audit-logs",
            routeTemplate: "/audit-logs",
            token,
            query: queryParams(query),
          },
          auditListSchema
        )
      );
    },
    async get(id: number): Promise<AuditRow> {
      if (!Number.isSafeInteger(id) || id < 1) throw new Error("Invalid audit entry");
      return required(
        await client.request(
          {
            method: "GET",
            path: "/audit-logs",
            routeTemplate: "/audit-logs",
            token,
            query: { id },
          },
          auditDetailSchema
        )
      );
    },
    async export(query: AuditQuery = {}) {
      return required(
        await client.request(
          {
            method: "GET",
            path: "/audit-logs",
            routeTemplate: "/audit-logs",
            token,
            query: { ...queryParams(query), format: "csv" },
          },
          auditExportSchema
        )
      );
    },
  };
}
async function bound() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error("Sign in required");
  return createAuditApi(createPortalApiClient(), token);
}
export const auditApi = {
  async list(query?: AuditQuery) {
    return (await bound()).list(query);
  },
};
