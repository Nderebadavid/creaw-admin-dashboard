import { cookies } from "next/headers";
import type { ApiClient } from "@/lib/api/client";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { collectPages } from "@/lib/api/pagination";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { applicationListSchema, applicationDetailSchema, awardListSchema, disbursementListSchema, documentListSchema, documentDetailSchema, projectListSchema, pillarListSchema, mutationSchema, packSchema, exportSchema, type ApplicationDto } from "./schemas";

export interface GrantQuery { page?: number; pageSize?: number; pillarId?: number; status?: string; search?: string }
export interface GrantRow { id: number; applicant: string; project: string; pillarId: number; status: string; requestedAmount: string; grantType: string; createdAt: string }
export interface GrantDetail extends GrantRow { notes: string | null; participantId: number | null; organisationId: number | null; stage: number; nextStatus: "PREPARED" | "REVIEWED" | "APPROVED" | null; award: { id: number; amountAwarded: string; currency: string; lifecycle: string } | null; disbursements: { id: number; amount: string; date: string | null; notes: string | null }[]; documents: { id: number; name: string }[] }
export interface GrantPage { items: GrantRow[]; page: number; pageSize: number; totalItems: number; totalPages: number }
function required<T>(result: { success: boolean; data: T | null; message: string }): T { if (!result.success || !result.data) throw new Error(result.message); return result.data; }
const stages = ["ACTIVE", "PREPARED", "REVIEWED", "APPROVED"] as const;
// TODO(schema): status/status_description are the only persisted sign-off markers; per-officer timestamps are not represented.
export function stageFor(status: string) { return Math.max(0, stages.indexOf(status as typeof stages[number])); }

export function createGrantsApi(client: ApiClient, token: string) {
  const request = <T>(input: Parameters<ApiClient["request"]>[0], schema: Parameters<ApiClient["request"]>[1]) => client.request(input, schema) as Promise<T>;
  const all = <T>(table: "grant_award" | "grant_disbursement" | "document" | "project", schema: Parameters<ApiClient["request"]>[1]) => collectPages<T>(async (page, pageSize) => {
    const family = table === "project" ? "/reports" : "/grants";
    const result = await request<{ success: boolean; data: { items: T[]; page: number; pageSize: number; totalItems: number; totalPages: number } | null; message: string }>({ method: "GET", path: family, routeTemplate: family, token, query: { table, page, pageSize } }, schema);
    return required(result);
  });
  async function projects() { return all<import("zod").infer<typeof import("./schemas").projectSchema>>("project", projectListSchema); }
  async function enrich(rows: ApplicationDto[]) {
    const projectRows = await projects();
    return rows.map(row => {
      const project = projectRows.find(item => item.id === row.project_id);
      return { id: row.id, applicant: row.participant_id ? `Participant #${row.participant_id}` : `Organisation #${row.organisation_id}`, project: project?.name ?? `Project #${row.project_id}`, pillarId: project?.pillar_id ?? 0, status: row.status, requestedAmount: `KES ${row.requested_amount.toLocaleString("en-KE")}`, grantType: row.grant_type, createdAt: row.created_at };
    });
  }
  return {
    async pillars() { return collectPages(async (page, pageSize) => required(await request<import("zod").infer<typeof pillarListSchema>>({ method: "GET", path: "/lookups/pillar", routeTemplate: "/lookups/:table", token, query: { page, pageSize } }, pillarListSchema))); },
    async list(query: GrantQuery = {}): Promise<GrantPage> {
      const result = await request<import("zod").infer<typeof applicationListSchema>>({ method: "GET", path: "/grants", routeTemplate: "/grants", token, query: { page: query.page ?? 1, pageSize: query.pageSize ?? 25, pillarId: query.pillarId, status: query.status, search: query.search } }, applicationListSchema);
      const data = required(result);
      return { ...data, items: await enrich(data.items) };
    },
    async get(id: number): Promise<GrantDetail | null> {
      const result = await request<import("zod").infer<typeof applicationDetailSchema>>({ method: "GET", path: `/grants/${id}`, routeTemplate: "/grants/:id", token }, applicationDetailSchema);
      if (!result.success || !result.data) return null;
      const row = result.data;
      const [summary] = await enrich([row]);
      const awards = await all<import("zod").infer<typeof import("./schemas").awardSchema>>("grant_award", awardListSchema).catch(() => []);
      const award = awards.find(item => item.application_id === id);
      const disbursements = award ? await all<import("zod").infer<typeof import("./schemas").disbursementSchema>>("grant_disbursement", disbursementListSchema).catch(() => []) : [];
      const documents = await all<import("zod").infer<typeof import("./schemas").documentSchema>>("document", documentListSchema).catch(() => []);
      const stage = stageFor(row.status);
      return { ...summary, notes: row.notes, participantId: row.participant_id, organisationId: row.organisation_id, stage,
        nextStatus: stage < 3 ? stages[stage + 1] as GrantDetail["nextStatus"] : null,
        award: award ? { id: award.id, amountAwarded: award.amount_awarded, currency: award.currency, lifecycle: award.grant_lifecycle_status } : null,
        disbursements: disbursements.filter(item => item.grant_id === award?.id).map(item => ({ id: item.id, amount: item.amount, date: item.disbursement_date, notes: item.notes })),
        documents: documents.filter(item => item.owner_type === "grant_application" && item.owner_id === id).map(item => ({ id: item.id, name: item.document_type.replaceAll("_", " ") })) };
    },
    advance(id: number, status: "PREPARED" | "REVIEWED" | "APPROVED") { return request<import("zod").infer<typeof mutationSchema>>({ method: "PATCH", path: `/grants/${id}`, routeTemplate: "/grants/:id", token, body: { status } }, mutationSchema); },
    recordDisbursement(grantId: number, amount: number, date: string, notes?: string) { return request<import("zod").infer<typeof mutationSchema>>({ method: "POST", path: "/grants", routeTemplate: "/grants", token, query: { table: "grant_disbursement" }, body: { grant_id: grantId, amount, disbursement_date: date, notes: notes ?? null } }, mutationSchema); },
    downloadPack(id: number) { return request<import("zod").infer<typeof packSchema>>({ method: "GET", path: `/grants/${id}`, routeTemplate: "/grants/:id", token, query: { pack: true } }, packSchema); },
    viewDocument(id: number) { return request<import("zod").infer<typeof documentDetailSchema>>({ method: "GET", path: `/grants/${id}`, routeTemplate: "/grants/:id", token, query: { table: "document", download: true } }, documentDetailSchema); },
    export(query: GrantQuery) { return request<import("zod").infer<typeof exportSchema>>({ method: "GET", path: "/grants", routeTemplate: "/grants", token, query: { pillarId: query.pillarId, status: query.status, search: query.search, format: "csv" } }, exportSchema); },
  };
}
async function bound() { const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value; if (!token) throw new Error("Sign in required"); return createGrantsApi(createPortalApiClient(), token); }
export const grantsApi = { async list(query?: GrantQuery) { return (await bound()).list(query); }, async get(id: number) { return (await bound()).get(id); }, async pillars() { return (await bound()).pillars(); } };
