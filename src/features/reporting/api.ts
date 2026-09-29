import type { ApiClient } from "@/lib/api/client";
import { withSessionApi } from "@/lib/api/session-api";
import {
  reportPageSchema,
  catalogSchema,
  documentDetailSchema,
  mutationSchema,
  exportSchema,
} from "./schemas";
import type { z } from "zod";

export interface ReportQuery {
  page?: number;
  pageSize?: number;
  pillarId?: number;
  ownerId?: number;
  status?: string;
  search?: string;
}
export interface ReportView {
  key: string;
  id: number;
  type: "narrative" | "grant";
  applicationId: number | null;
  title: string;
  project: string;
  pillarId: number;
  pillar: string;
  ownerId: number | null;
  ownerName: string | null;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: string;
  submittedDate: string | null;
  documentId: number | null;
}
export interface ReportPage {
  items: ReportView[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
export type ReportCatalog = NonNullable<z.infer<typeof catalogSchema>["data"]>;
function required<T>(result: { success: boolean; data: T | null; message: string }): T {
  if (!result.success || !result.data) throw new Error(result.message);
  return result.data;
}

export function createReportingApi(client: ApiClient, token: string) {
  const request = <T>(
    input: Parameters<ApiClient["request"]>[0],
    schema: Parameters<ApiClient["request"]>[1]
  ) => client.request(input, schema) as Promise<T>;
  const list = async (query: ReportQuery = {}): Promise<ReportPage> =>
    required(
      await request<z.infer<typeof reportPageSchema>>(
        {
          method: "GET",
          path: "/reports",
          routeTemplate: "/reports",
          token,
          query: {
            calendar: true,
            page: query.page ?? 1,
            pageSize: query.pageSize ?? 25,
            pillarId: query.pillarId,
            ownerId: query.ownerId,
            status: query.status,
            search: query.search,
          },
        },
        reportPageSchema
      )
    );
  return {
    list,
    viewDocument(id: number) {
      return request<z.infer<typeof documentDetailSchema>>(
        {
          method: "GET",
          path: `/reports/${id}`,
          routeTemplate: "/reports/:id",
          token,
          query: { table: "document", download: true },
        },
        documentDetailSchema
      );
    },
    async get(type: "narrative" | "grant", id: number) {
      for (let page = 1; ; page++) {
        const result = await list({ page, pageSize: 100 });
        const found = result.items.find((row) => row.type === type && row.id === id);
        if (found) return found;
        if (page >= result.totalPages) return null;
      }
    },
    addDeadline(input: {
      projectId: number;
      title: string;
      periodStart: string;
      periodEnd: string;
    }) {
      return request<z.infer<typeof mutationSchema>>(
        {
          method: "POST",
          path: "/reports",
          routeTemplate: "/reports",
          token,
          body: {
            project_id: input.projectId,
            notes: input.title,
            reporting_period_start: input.periodStart,
            reporting_period_end: input.periodEnd,
            report_status: "pending",
          },
        },
        mutationSchema
      );
    },
    async submit(type: "narrative" | "grant", id: number, date: string, fileUrl?: string) {
      let documentId: number | undefined;
      if (fileUrl) {
        const document = await request<z.infer<typeof mutationSchema>>(
          {
            method: "POST",
            path: "/reports",
            routeTemplate: "/reports",
            token,
            query: { table: "document" },
            body: {
              owner_type: type === "grant" ? "grant_report" : "narrative_report",
              owner_id: id,
              document_type: "report",
              file_url: fileUrl,
            },
          },
          mutationSchema
        );
        if (!document.success || !document.data) return document;
        documentId = document.data.id;
      }
      return request<z.infer<typeof mutationSchema>>(
        {
          method: "PATCH",
          path: `/reports/${id}`,
          routeTemplate: "/reports/:id",
          token,
          query: type === "grant" ? { table: "grant_report" } : undefined,
          body:
            type === "grant"
              ? { submitted_date: date, ...(documentId ? { document_id: documentId } : {}) }
              : { submitted_date: date, report_status: "submitted" },
        },
        mutationSchema
      );
    },
    export(query: ReportQuery) {
      return request<z.infer<typeof exportSchema>>(
        {
          method: "GET",
          path: "/reports",
          routeTemplate: "/reports",
          token,
          query: {
            calendar: true,
            format: "csv",
            pillarId: query.pillarId,
            ownerId: query.ownerId,
            status: query.status,
            search: query.search,
          },
        },
        exportSchema
      );
    },
    async catalog(): Promise<ReportCatalog> {
      return required(
        await request<z.infer<typeof catalogSchema>>(
          {
            method: "GET",
            path: "/reports",
            routeTemplate: "/reports",
            token,
            query: { catalog: true },
          },
          catalogSchema
        )
      );
    },
  };
}
function bound() {
  return withSessionApi(createReportingApi);
}
export const reportingApi = {
  async list(query?: ReportQuery) {
    return (await bound()).list(query);
  },
  async catalog() {
    return (await bound()).catalog();
  },
};
