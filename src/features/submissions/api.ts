import type { ApiClient } from "@/lib/api/client";
import { withSessionApi } from "@/lib/api/session-api";
import { collectPages } from "@/lib/api/pagination";
import { dashboardDtoSchema } from "@/features/dashboard/schemas";
import {
  enrollmentDetailSchema,
  enrollmentLookupSchema,
  submissionDetailSchema,
  submissionListSchema,
  submissionMutationSchema,
  type SubmissionDto,
} from "./schemas";
import { filterSubmissionRows } from "./filter";

export type SubmissionStatus = "Pending review" | "Flagged" | "Approved";
export interface SubmissionRow {
  id: number;
  title: string;
  type: string;
  pillarId: number | null;
  pillar: string;
  captured: string;
  source: string;
  status: SubmissionStatus;
  flag: string | null;
}
export interface SubmissionQuery {
  page?: number;
  pageSize?: number;
  status?: SubmissionStatus | "All";
  search?: string;
}
export interface SubmissionList {
  items: SubmissionRow[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

function statusOf(value: string): SubmissionStatus {
  return value === "verified" ? "Approved" : value === "disputed" ? "Flagged" : "Pending review";
}

export function createSubmissionsApi(client: ApiClient, token: string) {
  async function enrich(rows: SubmissionDto[], directEnrollment = false): Promise<SubmissionRow[]> {
    const [enrollmentResponse, dashboardResponse] = await Promise.all([
      directEnrollment
        ? Promise.all(
            [...new Set(rows.map((row) => row.enrollment_id))].map(async (id) => {
              const response = await client
                .request(
                  {
                    method: "GET",
                    path: `/participants/${id}`,
                    routeTemplate: "/participants/:id",
                    token,
                    query: { table: "enrollment" },
                  },
                  enrollmentDetailSchema
                )
                .catch(() => null);
              return response?.data ?? null;
            })
          ).then((items) => items.filter((item): item is NonNullable<typeof item> => item !== null))
        : collectPages(async (page, pageSize) => {
            const response = await client.request(
              {
                method: "GET",
                path: "/participants",
                routeTemplate: "/participants",
                token,
                query: { table: "enrollment", page, pageSize },
              },
              enrollmentLookupSchema
            );
            if (!response.success || !response.data) throw new Error(response.message);
            return response.data;
          }).catch(() => []),
      client
        .request(
          { method: "GET", path: "/dashboard", routeTemplate: "/dashboard", token },
          dashboardDtoSchema
        )
        .catch(() => null),
    ]);
    const enrollments = new Map(enrollmentResponse.map((row) => [row.id, row]));
    const pillars = new Map(dashboardResponse?.data?.pillars.map((row) => [row.id, row.name]));
    return rows.map((row) => {
      const enrollment = enrollments.get(row.enrollment_id);
      const [title] = (row.notes ?? `Submission #${row.id}`).split(" — ", 2);
      return {
        id: row.id,
        title,
        type: enrollment?.entry_category ?? "Field update",
        pillarId: enrollment?.pillar_id ?? null,
        pillar: enrollment
          ? (pillars.get(enrollment.pillar_id) ?? `Pillar #${enrollment.pillar_id}`)
          : "Pillar unavailable",
        captured: row.event_date,
        source: row.source_channel,
        status: statusOf(row.stage_event_status),
        flag: row.stage_event_status === "disputed" ? "Requires follow-up" : null,
      };
    });
  }
  async function loadAll(): Promise<SubmissionRow[]> {
    const rows = await collectPages(async (page, pageSize) => {
      const response = await client.request(
        {
          method: "GET",
          path: "/field-submissions",
          routeTemplate: "/field-submissions",
          token,
          query: { page, pageSize },
        },
        submissionListSchema
      );
      if (!response.success || !response.data) throw new Error(response.message);
      return response.data;
    });
    return enrich(rows);
  }
  return {
    async list(query: SubmissionQuery = {}): Promise<SubmissionList> {
      const page = query.page ?? 1,
        pageSize = query.pageSize ?? 25;
      const filtered = filterSubmissionRows(await loadAll(), query);
      return {
        items: filtered.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        totalItems: filtered.length,
        totalPages: Math.ceil(filtered.length / pageSize),
      };
    },
    listAll: loadAll,
    async get(id: number): Promise<SubmissionRow | null> {
      const response = await client.request(
        {
          method: "GET",
          path: `/field-submissions/${id}`,
          routeTemplate: "/field-submissions/:id",
          token,
        },
        submissionDetailSchema
      );
      if (!response.success || !response.data) return null;
      return (await enrich([response.data], true))[0];
    },
    async review(id: number, decision: "approve" | "flag") {
      return client.request(
        {
          method: "PATCH",
          path: `/field-submissions/${id}`,
          routeTemplate: "/field-submissions/:id",
          token,
          body: { stage_event_status: decision === "approve" ? "verified" : "disputed" },
        },
        submissionMutationSchema
      );
    },
  };
}

export const submissionsApi = {
  async list(query: SubmissionQuery = {}) {
    return (await withSessionApi(createSubmissionsApi)).list(query);
  },
  async listAll() {
    return (await withSessionApi(createSubmissionsApi)).listAll();
  },
};
