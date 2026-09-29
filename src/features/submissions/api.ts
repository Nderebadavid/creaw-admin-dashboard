import type { ApiClient } from "@/lib/api/client";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { dashboardDtoSchema } from "@/features/dashboard/schemas";
import { enrollmentLookupSchema, submissionDetailSchema, submissionListSchema, submissionMutationSchema, type SubmissionDto } from "./schemas";

export type SubmissionStatus = "Pending review" | "Flagged" | "Approved";
export interface SubmissionRow {
  id: number; title: string; type: string; pillarId: number | null; pillar: string;
  captured: string; source: string; status: SubmissionStatus; flag: string | null;
}
export interface SubmissionQuery { page?: number; pageSize?: number; status?: SubmissionStatus | "All"; search?: string }
export interface SubmissionList { items: SubmissionRow[]; page: number; pageSize: number; totalItems: number; totalPages: number }

function statusOf(value: string): SubmissionStatus {
  return value === "verified" ? "Approved" : value === "disputed" ? "Flagged" : "Pending review";
}

export function createSubmissionsApi(client: ApiClient, token: string) {
  async function enrich(rows: SubmissionDto[]): Promise<SubmissionRow[]> {
    const [enrollmentResponse, dashboardResponse] = await Promise.all([
      client.request({ method: "GET", path: "/participants", routeTemplate: "/participants", token, query: { table: "enrollment", pageSize: 100 } }, enrollmentLookupSchema).catch(() => null),
      client.request({ method: "GET", path: "/dashboard", routeTemplate: "/dashboard", token }, dashboardDtoSchema).catch(() => null),
    ]);
    const enrollments = new Map(enrollmentResponse?.data?.items.map(row => [row.id, row]));
    const pillars = new Map(dashboardResponse?.data?.pillars.map(row => [row.id, row.name]));
    return rows.map(row => {
      const enrollment = enrollments.get(row.enrollment_id);
      const [title] = (row.notes ?? `Submission #${row.id}`).split(" — ", 2);
      return { id: row.id, title, type: enrollment?.entry_category ?? "Field update", pillarId: enrollment?.pillar_id ?? null,
        pillar: enrollment ? pillars.get(enrollment.pillar_id) ?? `Pillar #${enrollment.pillar_id}` : "Pillar unavailable",
        captured: row.event_date, source: row.source_channel, status: statusOf(row.stage_event_status), flag: row.stage_event_status === "disputed" ? "Requires follow-up" : null };
    });
  }
  return {
    async list(query: SubmissionQuery = {}): Promise<SubmissionList> {
      const response = await client.request({ method: "GET", path: "/field-submissions", routeTemplate: "/field-submissions", token,
        query: { page: query.page ?? 1, pageSize: query.pageSize ?? 25, search: query.search || undefined,
          stage_event_status: query.status && query.status !== "All" ? ({ "Pending review": "recorded", Flagged: "disputed", Approved: "verified" } as const)[query.status] : undefined },
      }, submissionListSchema);
      if (!response.success || !response.data) throw new Error(response.message);
      return { ...response.data, items: await enrich(response.data.items) };
    },
    async get(id: number): Promise<SubmissionRow | null> {
      const response = await client.request({ method: "GET", path: `/field-submissions/${id}`, routeTemplate: "/field-submissions/:id", token }, submissionDetailSchema);
      if (!response.success || !response.data) return null;
      return (await enrich([response.data]))[0];
    },
    async review(id: number, decision: "approve" | "flag") {
      return client.request({ method: "PATCH", path: `/field-submissions/${id}`, routeTemplate: "/field-submissions/:id", token,
        body: { stage_event_status: decision === "approve" ? "verified" : "disputed" },
      }, submissionMutationSchema);
    },
  };
}

export const submissionsApi = {
  async list(query: SubmissionQuery = {}) {
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    if (!token) throw new Error("Sign in required");
    return createSubmissionsApi(createPortalApiClient(), token).list(query);
  },
};
