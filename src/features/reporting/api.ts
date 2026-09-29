import { cookies } from "next/headers";
import type { ApiClient } from "@/lib/api/client";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { collectPages } from "@/lib/api/pagination";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { narrativeListSchema, grantReportListSchema, projectListSchema, pillarListSchema, awardListSchema, applicationListSchema, documentListSchema, documentDetailSchema, ownersSchema, mutationSchema, exportSchema, type narrativeSchema, type grantReportSchema, type projectSchema, type pillarSchema, type awardSchema, type applicationSchema, type documentSchema } from "./schemas";
import type { z } from "zod";

type Narrative = z.infer<typeof narrativeSchema>; type GrantReport = z.infer<typeof grantReportSchema>;
type Project = z.infer<typeof projectSchema>; type Pillar = z.infer<typeof pillarSchema>;
type Award = z.infer<typeof awardSchema>; type Application = z.infer<typeof applicationSchema>;
type Document = z.infer<typeof documentSchema>;
export interface ReportQuery { page?: number; pageSize?: number; pillarId?: number; ownerId?: number; status?: string; search?: string }
export interface ReportView { key: string; id: number; type: "narrative" | "grant"; title: string; project: string; pillarId: number; pillar: string; ownerId: number | null; ownerName?: string | null; dueDate: string; status: string; submittedDate: string | null; documentId: number | null }
export interface ReportPage { items: ReportView[]; page: number; pageSize: number; totalItems: number; totalPages: number }
function required<T>(result: { success: boolean; data: T | null; message: string }): T { if (!result.success || !result.data) throw new Error(result.message); return result.data; }
export function createReportingApi(client: ApiClient, token: string) {
  const request = <T>(input: Parameters<ApiClient["request"]>[0], schema: Parameters<ApiClient["request"]>[1]) => client.request(input, schema) as Promise<T>;
  const all = <T>(table: string | undefined, family: "/reports" | "/grants" | "/lookups/:table", schema: Parameters<ApiClient["request"]>[1]) => collectPages<T>(async (page, pageSize) => {
    const path = family === "/lookups/:table" ? "/lookups/pillar" : family;
    const result = await request<{ success: boolean; data: { items: T[]; page: number; pageSize: number; totalItems: number; totalPages: number } | null; message: string }>({ method: "GET", path, routeTemplate: family, token, query: { table, page, pageSize } }, schema);
    return required(result);
  });
  async function owners() { return required(await request<z.infer<typeof ownersSchema>>({ method: "GET", path: "/reports", routeTemplate: "/reports", token, query: { owners: true } }, ownersSchema)); }
  async function allRows(): Promise<ReportView[]> {
    const [narratives, grantReports, projects, pillars, awards, applications, documents, ownerRows] = await Promise.all([
      all<Narrative>(undefined, "/reports", narrativeListSchema).catch(() => []),
      all<GrantReport>("grant_report", "/reports", grantReportListSchema).catch(() => []),
      all<Project>("project", "/reports", projectListSchema), all<Pillar>(undefined, "/lookups/:table", pillarListSchema),
      all<Award>("grant_award", "/grants", awardListSchema).catch(() => []), all<Application>(undefined, "/grants", applicationListSchema).catch(() => []),
      all<Document>("document", "/reports", documentListSchema).catch(() => []), owners(),
    ]);
    const projectForGrant = (row: GrantReport) => {
      const award = awards.find(item => item.id === row.grant_award_id);
      const application = applications.find(item => item.id === award?.application_id);
      return projects.find(item => item.id === application?.project_id);
    };
    const map = (type: "narrative" | "grant", id: number, title: string, project: Project | undefined, dueDate: string, status: string, submittedDate: string | null, documentId: number | null): ReportView => {
      const pillar = pillars.find(item => item.id === project?.pillar_id);
      return { key: `${type}-${id}`, id, type, title, project: project?.name ?? "Programme", pillarId: project?.pillar_id ?? 0, pillar: pillar?.name ?? "Pillar", ownerId: pillar?.lead_user_id ?? null, ownerName: ownerRows.find(owner => owner.id === pillar?.lead_user_id)?.name ?? null, dueDate, status, submittedDate, documentId };
    };
    return [
      ...narratives.map(row => map("narrative", row.id, row.notes ?? `Narrative report #${row.id}`, projects.find(item => item.id === row.project_id), row.reporting_period_end, row.report_status === "submitted" || row.report_status === "overdue" ? row.report_status : row.reporting_period_end < new Date().toISOString().slice(0, 10) ? "overdue" : "pending", row.submitted_date, documents.find(item => item.owner_type === "narrative_report" && item.owner_id === row.id)?.id ?? null)),
      ...grantReports.map(row => map("grant", row.id, row.notes ?? `Grant report #${row.id}`, projectForGrant(row), row.due_date, row.submitted_date ? "submitted" : row.due_date < new Date().toISOString().slice(0, 10) ? "overdue" : "pending", row.submitted_date, row.document_id)),
    ].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.key.localeCompare(b.key));
  }
  return {
    viewDocument(id: number) { return request<z.infer<typeof documentDetailSchema>>({ method: "GET", path: `/reports/${id}`, routeTemplate: "/reports/:id", token, query: { table: "document", download: true } }, documentDetailSchema); },
    async get(type: "narrative" | "grant", id: number) { return (await allRows()).find(row => row.type === type && row.id === id) ?? null; },
    async list(query: ReportQuery = {}): Promise<ReportPage> {
      const rows = (await allRows()).filter(row => (query.pillarId === undefined || row.pillarId === query.pillarId) && (query.ownerId === undefined || row.ownerId === query.ownerId) && (!query.status || row.status === query.status) && (!query.search || `${row.title} ${row.project} ${row.pillar}`.toLowerCase().includes(query.search.toLowerCase())));
      const page = query.page ?? 1, pageSize = query.pageSize ?? 25;
      return { items: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalItems: rows.length, totalPages: Math.ceil(rows.length / pageSize) };
    },
    addDeadline(input: { projectId: number; title: string; periodStart: string; periodEnd: string }) { return request<z.infer<typeof mutationSchema>>({ method: "POST", path: "/reports", routeTemplate: "/reports", token, body: { project_id: input.projectId, notes: input.title, reporting_period_start: input.periodStart, reporting_period_end: input.periodEnd, report_status: "pending" } }, mutationSchema); },
    async submit(type: "narrative" | "grant", id: number, date: string, fileUrl?: string) {
      let documentId: number | undefined;
      if (fileUrl) {
        const document = await request<z.infer<typeof mutationSchema>>({ method: "POST", path: "/reports", routeTemplate: "/reports", token, query: { table: "document" }, body: { owner_type: type === "grant" ? "grant_report" : "narrative_report", owner_id: id, document_type: "report", file_url: fileUrl } }, mutationSchema);
        if (!document.success || !document.data) return document;
        documentId = document.data.id;
      }
      return request<z.infer<typeof mutationSchema>>({ method: "PATCH", path: `/reports/${id}`, routeTemplate: "/reports/:id", token, query: type === "grant" ? { table: "grant_report" } : undefined, body: type === "grant" ? { submitted_date: date, ...(documentId ? { document_id: documentId } : {}) } : { submitted_date: date, report_status: "submitted" } }, mutationSchema);
    },
    export(query: ReportQuery) { return request<z.infer<typeof exportSchema>>({ method: "GET", path: "/reports", routeTemplate: "/reports", token, query: { calendar: true, format: "csv", pillarId: query.pillarId, ownerId: query.ownerId, status: query.status, search: query.search } }, exportSchema); },
    async catalog() { const [projects, pillars, ownerRows] = await Promise.all([all<Project>("project", "/reports", projectListSchema), all<Pillar>(undefined, "/lookups/:table", pillarListSchema), owners()]); return { projects, pillars, owners: ownerRows }; },
  };
}
async function bound() { const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value; if (!token) throw new Error("Sign in required"); return createReportingApi(createPortalApiClient(), token); }
export const reportingApi = { async list(query?: ReportQuery) { return (await bound()).list(query); }, async catalog() { return (await bound()).catalog(); } };
