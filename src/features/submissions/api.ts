/**
 * Typed client for field submissions synced from the mobile app.
 *
 * `create*Api(client, token)` maps API DTOs into view models and is what tests
 * exercise directly; the exported singleton binds it to the signed-in session
 * for Server Components. Responses are envelope-validated with Zod; the API
 * applies permission and pillar-scope filtering and masks sensitive fields.
 */
import { cache } from "react";
import type { ApiClient } from "@/lib/api/client";
import { withSessionApi } from "@/lib/api/session-api";
import { collectPages } from "@/lib/api/pagination";
import type { PaginatedData } from "@/types/api";
import type { z } from "zod";
import { dashboardDtoSchema } from "@/features/dashboard/schemas";
import {
  enrollmentDetailSchema,
  enrollmentLookupSchema,
  participantPlaceSchema,
  placeLookupSchema,
  stageLookupSchema,
  submissionDocumentDetailSchema,
  submissionDocumentListSchema,
  type submissionDocumentSchema,
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
    const [stages, places, documents] = await Promise.all([
      stageNames(dashboardResponse?.data?.pillars ?? []),
      participantPlaces(),
      pages<z.infer<typeof submissionDocumentSchema>>(
        "/field-submissions",
        "/field-submissions",
        { table: "document" },
        submissionDocumentListSchema
      ),
    ]);
    return rows.map((row) => {
      const enrollment = enrollments.get(row.enrollment_id);
      const [title] = (row.notes ?? `Submission #${row.id}`).split(" — ", 2);
      return {
        id: row.id,
        title,
        type: stages.get(row.stage_definition_id) ?? enrollment?.entry_category ?? "Field update",
        category: enrollment?.entry_category,
        pillarId: enrollment?.pillar_id ?? null,
        pillar: enrollment
          ? (pillars.get(enrollment.pillar_id) ?? `Pillar #${enrollment.pillar_id}`)
          : "Pillar unavailable",
        captured: row.event_date,
        source: row.source_channel,
        status: statusOf(row.stage_event_status),
        flag: row.stage_event_status === "disputed" ? "Requires follow-up" : null,
        place: enrollment?.participant_id ? (places.get(enrollment.participant_id) ?? null) : null,
        photos: documents
          .filter((doc) => doc.owner_type === "participant_stage_event" && doc.owner_id === row.id)
          .map((doc) => ({ id: doc.id, name: doc.document_type.replaceAll("_", " ") })),
      };
    });
  }
  /** Every page of a list, or none when the user may not read it. */
  const pages = <T>(
    path: string,
    routeTemplate: "/pillars/:pillar" | "/participants" | "/lookups/:table" | "/field-submissions",
    query: Record<string, string>,
    schema: Parameters<ApiClient["request"]>[1]
  ) =>
    collectPages<T>(async (page, pageSize) => {
      const response = (await client.request(
        { method: "GET", path, routeTemplate, token, query: { ...query, page, pageSize } },
        schema
      )) as { success: boolean; message: string; data: PaginatedData<T> | null };
      if (!response.success || !response.data) throw new Error(response.message);
      return response.data;
    }).catch(() => [] as T[]);
  /** Stage names by id, from each pillar's pipeline. */
  async function stageNames(pillars: readonly { code: string }[]) {
    const lists = await Promise.all(
      pillars.map((pillar) =>
        pages<{ id: number; name: string }>(
          `/pillars/${pillar.code.toLowerCase()}`,
          "/pillars/:pillar",
          { table: "stage_definition" },
          stageLookupSchema
        )
      )
    );
    return new Map(lists.flat().map((stage) => [stage.id, stage.name]));
  }
  /** "Ward · County" for each participant the user can see. */
  async function participantPlaces() {
    type Place = { id: number; name: string; sub_county_id?: number; county_id?: number };
    const [participants, wards, subCounties, counties] = await Promise.all([
      pages<{ id: number; ward_id: number | null }>(
        "/participants",
        "/participants",
        {},
        participantPlaceSchema
      ),
      pages<Place>("/lookups/ward", "/lookups/:table", {}, placeLookupSchema),
      pages<Place>("/lookups/sub_county", "/lookups/:table", {}, placeLookupSchema),
      pages<Place>("/lookups/county", "/lookups/:table", {}, placeLookupSchema),
    ]);
    const places = new Map<number, string>();
    for (const participant of participants) {
      const ward = wards.find((row) => row.id === participant.ward_id);
      if (!ward) continue;
      const subCounty = subCounties.find((row) => row.id === ward.sub_county_id);
      const county = counties.find((row) => row.id === subCounty?.county_id);
      places.set(participant.id, county ? `${ward.name} · ${county.name}` : ward.name);
    }
    return places;
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
    // Stage moves recorded on the portal (e.g. a WRO pipeline step) are not field submissions.
    return enrich(rows.filter((row) => row.source_channel !== "portal"));
  }
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
  /**
   * Every submission in scope. Cached per request: the portal layout's badge
   * count and the submissions or pillar page would otherwise each page
   * through all submissions and enrollments.
   */
  listAll: cache(async () => (await withSessionApi(createSubmissionsApi)).listAll()),
  async countUnapproved() {
    return (await withSessionApi(createSubmissionsApi)).countUnapproved();
  },
};
