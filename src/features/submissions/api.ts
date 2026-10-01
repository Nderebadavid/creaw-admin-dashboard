/**
 * Typed client for field submissions synced from the mobile app.
 *
 * `create*Api(client, token)` maps API DTOs into view models and is what tests
 * exercise directly; the exported singleton binds it to the signed-in session
 * for Server Components. Responses are envelope-validated with Zod; the API
 * applies permission and pillar-scope filtering and masks sensitive fields.
 */
import type { ApiClient } from "@/lib/api/client";
import { clampPageSize, listParams } from "@/lib/api/list";
import { withSessionApi } from "@/lib/api/session-api";
import type { PaginatedData } from "@/types/api";
import {
  submissionDetailSchema,
  submissionDocumentDetailSchema,
  submissionListSchema,
  submissionMutationSchema,
  type SubmissionDto,
} from "./schemas";

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
  /** Where the participant lives, e.g. "Kibera · Nairobi"; null when unknown. */
  place?: string | null;
  /** The programme category of the enrollment the update belongs to. */
  category?: string;
  /** Photos captured with the submission, e.g. "group photo". */
  photos?: { id: number; name: string }[];
}
export interface SubmissionQuery {
  page?: number;
  pageSize?: number;
  status?: SubmissionStatus | "All";
  search?: string;
  /** Only this pillar's submissions. */
  pillarId?: number;
}
/** A page of submissions; `facets.review_status` holds the count per review status over the same search and pillar. */
export type SubmissionList = PaginatedData<SubmissionRow>;

function statusOf(value: string): SubmissionStatus {
  return value === "verified" ? "Approved" : value === "disputed" ? "Flagged" : "Pending review";
}

/** A submission as the pages show it, from one API row (names and photos arrive with it). */
function rowOf(row: SubmissionDto): SubmissionRow {
  const [title] = (row.notes ?? `Submission #${row.id}`).split(" — ", 2);
  return {
    id: row.id,
    title,
    type: row.stage_name ?? row.entry_category ?? "Field update",
    category: row.entry_category ?? undefined,
    pillarId: row.pillar_id,
    pillar: row.pillar_name ?? (row.pillar_id ? `Pillar #${row.pillar_id}` : "Pillar unavailable"),
    captured: row.event_date,
    source: row.source_channel,
    status: statusOf(row.stage_event_status),
    flag: row.stage_event_status === "disputed" ? "Requires follow-up" : null,
    place: row.place,
    photos: row.documents.map((doc) => ({
      id: doc.id,
      name: doc.document_type.replaceAll("_", " "),
    })),
  };
}

export function createSubmissionsApi(client: ApiClient, token: string) {
  /** Submissions in scope with one stage_event_status, read as a single-row page. */
  async function countWithStatus(status: "recorded" | "disputed"): Promise<number> {
    const response = await client.request(
      {
        method: "GET",
        path: "/field-submissions",
        routeTemplate: "/field-submissions",
        token,
        query: { page: 1, pageSize: 1, stage_event_status: status },
      },
      submissionListSchema
    );
    if (!response.success || !response.data) throw new Error(response.message);
    return response.data.totalItems;
  }
  return {
    /** Submissions awaiting review or flagged: everything not yet approved. */
    async countUnapproved(): Promise<number> {
      const [recorded, disputed] = await Promise.all([
        countWithStatus("recorded"),
        countWithStatus("disputed"),
      ]);
      return recorded + disputed;
    },
    /**
     * One page of submissions, newest first, filtered and searched by the API. Each row
     * carries its pillar, stage, place and photos, so this is a single call. `counts`
     * holds the number of submissions per review status over the same search and pillar.
     */
    async list(query: SubmissionQuery = {}): Promise<SubmissionList> {
      const response = await client.request(
        {
          method: "GET",
          path: "/field-submissions",
          routeTemplate: "/field-submissions",
          token,
          query: {
            ...listParams(
              {
                page: query.page ?? 1,
                pageSize: clampPageSize(query.pageSize),
                search: query.search,
                include: "documents",
                filters: {
                  pillarId: query.pillarId,
                  review_status: query.status && query.status !== "All" ? query.status : undefined,
                },
              },
              {},
              { sort: "event_date:desc" }
            ),
            facet: "review_status",
          },
        },
        submissionListSchema
      );
      if (!response.success || !response.data) throw new Error(response.message);
      return { ...response.data, items: response.data.items.map(rowOf) };
    },
    async get(id: number): Promise<SubmissionRow | null> {
      const response = await client.request(
        {
          method: "GET",
          path: `/field-submissions/${id}`,
          routeTemplate: "/field-submissions/:id",
          token,
          query: { include: "documents" },
        },
        submissionDetailSchema
      );
      if (!response.success || !response.data) return null;
      return rowOf(response.data);
    },
    /** Opens a submission's photo; the API writes the access to the audit log. */
    viewDocument(documentId: number) {
      return client.request(
        {
          method: "GET",
          path: `/field-submissions/${documentId}`,
          routeTemplate: "/field-submissions/:id",
          token,
          query: { table: "document", download: true },
        },
        submissionDocumentDetailSchema
      );
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
  async countUnapproved() {
    return (await withSessionApi(createSubmissionsApi)).countUnapproved();
  },
};
