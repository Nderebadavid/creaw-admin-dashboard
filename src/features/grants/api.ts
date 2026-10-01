/**
 * Typed client for grant applications, their sign-off chain, awards, disbursements and compliance reports.
 *
 * `create*Api(client, token)` maps API DTOs into view models and is what tests
 * exercise directly; the exported singleton binds it to the signed-in session
 * for Server Components. Responses are envelope-validated with Zod; the API
 * applies permission and pillar-scope filtering and masks sensitive fields.
 */
import { z } from "zod";
import type { SortState } from "@/components/data-table/sorting";
import type { ApiClient } from "@/lib/api/client";
import { createEnvelopeSchema } from "@/lib/api/contracts";
import { withSessionApi } from "@/lib/api/session-api";
import { collectPages } from "@/lib/api/pagination";
import { listParams } from "@/lib/api/list";
import {
  applicationListSchema,
  applicationDetailSchema,
  documentDetailSchema,
  projectListSchema,
  pillarListSchema,
  mutationSchema,
  packSchema,
  signoffSchema,
  exportSchema,
  type ApplicationDto,
} from "./schemas";

export interface GrantQuery {
  /** A displayed column to sort by, mapped to an API field by the list. */
  sort?: SortState;
  page?: number;
  pageSize?: number;
  pillarId?: number;
  status?: string;
  search?: string;
}
/** The queue's column ids and the API fields they sort by. */
export const GRANT_SORT_KEYS: Record<string, string> = {
  applicant: "participant_name,organisation_name",
  project: "project_name",
  requested: "requested_amount",
  type: "grant_type",
  date: "created_at",
  stage: "stage_index",
  updated: "updated_at",
};

export interface GrantRow {
  id: number;
  applicant: string;
  project: string;
  pillarId: number;
  status: string;
  requestedAmount: string;
  grantType: string;
  createdAt: string;
  /** Why the application has its status, e.g. why it was declined. */
  statusDescription?: string | null;
  updatedAt?: string | null;
}
/** A Skilling graduate WEE accepted for a grant and has not yet filed an application for. */
export interface GrantRecommendation {
  participantId: number;
  name: string;
  course: string | null;
  acceptedOn: string | null;
  suggestedNotes: string;
}
const recommendationListSchema = createEnvelopeSchema(
  z.union([
    z.object({
      items: z.array(
        z.object({
          participant_id: z.number().int().positive(),
          participant_name: z.string(),
          course_name: z.string().nullable(),
          accepted_on: z.string().nullable(),
          suggested_notes: z.string(),
        })
      ),
    }),
    z.null(),
  ])
);

export interface GrantProgramme {
  id: number;
  name: string;
  pillarId: number;
}
export interface GrantHistoryEntry {
  event: "SUBMITTED" | "PREPARED" | "REVIEWED" | "APPROVED" | "DECLINED";
  /** The deciding officer; null for the application's arrival. */
  byName: string | null;
  at: string;
}
export interface GrantDetail extends GrantRow {
  notes: string | null;
  participantId: number | null;
  organisationId: number | null;
  /** Sign-off steps completed; for a declined application, the steps it had reached. */
  stage: number;
  /** The next sign-off step; null once approved or declined. */
  nextStatus: "PREPARED" | "REVIEWED" | "APPROVED" | null;
  /** Why the application was declined; null unless it was. */
  declineReason: string | null;
  signoffs: { preparedBy: number | null; reviewedBy: number | null; approvedBy: number | null };
  /** The application's arrival and every sign-off decision since, oldest first. */
  history: readonly GrantHistoryEntry[];
  award: { id: number; amountAwarded: number; currency: string; lifecycle: string } | null;
  reportingAwardId: number | null;
  disbursements: { id: number; amount: number; date: string | null; notes: string | null }[];
  reports: {
    id: number;
    periodStart: string;
    periodEnd: string;
    dueDate: string;
    submittedDate: string | null;
  }[];
  documents: { id: number; name: string }[];
}
export interface GrantPage {
  items: GrantRow[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
function required<T>(result: { success: boolean; data: T | null; message: string }): T {
  if (!result.success || !result.data) throw new Error(result.message);
  return result.data;
}
const stages = ["ACTIVE", "PREPARED", "REVIEWED", "APPROVED"] as const;
// TODO(schema): status/status_description are the only persisted sign-off markers; per-officer timestamps are not represented.
export function stageFor(status: string) {
  return Math.max(0, stages.indexOf(status as (typeof stages)[number]));
}

export function createGrantsApi(client: ApiClient, token: string) {
  const request = <T>(
    input: Parameters<ApiClient["request"]>[0],
    schema: Parameters<ApiClient["request"]>[1]
  ) => client.request(input, schema) as Promise<T>;
  const all = <T>(
    table: "grant_award" | "grant_disbursement" | "document" | "project",
    schema: Parameters<ApiClient["request"]>[1]
  ) =>
    collectPages<T>(async (page, pageSize) => {
      const family = table === "project" ? "/reports" : "/grants";
      const result = await request<{
        success: boolean;
        data: {
          items: T[];
          page: number;
          pageSize: number;
          totalItems: number;
          totalPages: number;
        } | null;
        message: string;
      }>(
        {
          method: "GET",
          path: family,
          routeTemplate: family,
          token,
          query: { table, page, pageSize },
        },
        schema
      );
      return required(result);
    });
  async function projects() {
    return all<import("zod").infer<typeof import("./schemas").projectSchema>>(
      "project",
      projectListSchema
    );
  }
  /** Rows as the queue shows them; the API names the applicant, project and its pillar. */
  function enrich(rows: ApplicationDto[]): GrantRow[] {
    return rows.map((row) => ({
      id: row.id,
      applicant:
        row.participant_name ??
        row.organisation_name ??
        (row.participant_id ? "Participant record" : "Organisation record"),
      project: row.project_name ?? "Programme",
      pillarId: row.project_pillar_id ?? 0,
      status: row.status,
      requestedAmount: `KES ${row.requested_amount.toLocaleString("en-KE")}`,
      grantType: row.grant_type,
      createdAt: row.created_at,
      statusDescription: row.status_description,
      updatedAt: row.updated_at,
    }));
  }
  return {
    /** Skilling graduates recommended to WEE and accepted, with no application yet. */
    async recommendations(): Promise<GrantRecommendation[]> {
      const result = await client.request(
        {
          method: "GET",
          path: "/grants",
          routeTemplate: "/grants",
          token,
          query: { view: "recommended" },
        },
        recommendationListSchema
      );
      return required(result).items.map((item) => ({
        participantId: item.participant_id,
        name: item.participant_name,
        course: item.course_name,
        acceptedOn: item.accepted_on,
        suggestedNotes: item.suggested_notes,
      }));
    },
    /** Grant programmes (projects) an application can be filed under. */
    async programmes(): Promise<GrantProgramme[]> {
      return (await projects()).map((row) => ({
        id: row.id,
        name: row.name,
        pillarId: row.pillar_id,
      }));
    },
    /**
     * Files an application for a participant. It starts as PREPARED, signed by
     * the officer who files it, so review and approval need two other officers.
     */
    create(input: {
      projectId: number;
      participantId: number;
      requestedAmount: number;
      grantType: string;
      notes?: string;
    }) {
      return request<import("zod").infer<typeof mutationSchema>>(
        {
          method: "POST",
          path: "/grants",
          routeTemplate: "/grants",
          token,
          body: {
            project_id: input.projectId,
            participant_id: input.participantId,
            requested_amount: input.requestedAmount,
            grant_type: input.grantType,
            notes: input.notes || null,
            status: "PREPARED",
          },
        },
        mutationSchema
      );
    },
    async pillars() {
      return collectPages(async (page, pageSize) =>
        required(
          await request<import("zod").infer<typeof pillarListSchema>>(
            {
              method: "GET",
              path: "/lookups/pillar",
              routeTemplate: "/lookups/:table",
              token,
              query: { page, pageSize },
            },
            pillarListSchema
          )
        )
      );
    },
    /** Applications still in their sign-off chain (neither approved nor declined), without enriching rows. */
    async countAwaitingSignoff(): Promise<number> {
      const total = async (status?: string) =>
        required(
          await request<import("zod").infer<typeof applicationListSchema>>(
            {
              method: "GET",
              path: "/grants",
              routeTemplate: "/grants",
              token,
              query: { page: 1, pageSize: 1, status },
            },
            applicationListSchema
          )
        ).totalItems;
      const [all, approved, declined] = await Promise.all([
        total(),
        total("APPROVED"),
        total("DECLINED"),
      ]);
      return all - approved - declined;
    },
    /** One page of applications; the API filters, searches and sorts. */
    async list(query: GrantQuery = {}): Promise<GrantPage> {
      const result = await request<import("zod").infer<typeof applicationListSchema>>(
        {
          method: "GET",
          path: "/grants",
          routeTemplate: "/grants",
          token,
          query: {
            ...listParams(
              {
                page: query.page ?? 1,
                pageSize: query.pageSize ?? 25,
                search: query.search,
                sort: query.sort,
                filters: { status: query.status },
              },
              GRANT_SORT_KEYS
            ),
            ...(query.pillarId ? { pillarId: query.pillarId } : {}),
          },
        },
        applicationListSchema
      );
      const data = required(result);
      return { ...data, items: enrich(data.items) };
    },
    /** An application with its sign-offs, award, payments, reporting periods and files: two calls. */
    async get(id: number): Promise<GrantDetail | null> {
      const result = await request<import("zod").infer<typeof applicationDetailSchema>>(
        {
          method: "GET",
          path: `/grants/${id}`,
          routeTemplate: "/grants/:id",
          token,
          query: { include: "awards,disbursements,reports,documents" },
        },
        applicationDetailSchema
      );
      if (!result.success || !result.data) return null;
      const row = result.data;
      const [summary] = enrich([row]);
      const signoffs = required(
        await request<import("zod").infer<typeof signoffSchema>>(
          {
            method: "GET",
            path: `/grants/${id}`,
            routeTemplate: "/grants/:id",
            token,
            query: { signoffs: true },
          },
          signoffSchema
        )
      );
      const award = row.awards[0];
      const declined = row.status === "DECLINED";
      // A declined application keeps the steps that were signed before it closed.
      const stage = declined
        ? signoffs.reviewedBy
          ? 2
          : signoffs.preparedBy
            ? 1
            : 0
        : stageFor(row.status);
      return {
        ...summary,
        notes: row.notes,
        participantId: row.participant_id,
        organisationId: row.organisation_id,
        stage,
        signoffs: {
          preparedBy: signoffs.preparedBy,
          reviewedBy: signoffs.reviewedBy,
          approvedBy: signoffs.approvedBy,
        },
        history: [{ event: "SUBMITTED", byName: null, at: row.created_at }, ...signoffs.history],
        nextStatus:
          !declined && stage < 3 ? (stages[stage + 1] as GrantDetail["nextStatus"]) : null,
        declineReason: declined ? (row.status_description ?? "") : null,
        award: award
          ? {
              id: award.id,
              amountAwarded: award.amount_awarded,
              currency: award.currency,
              lifecycle: award.grant_lifecycle_status,
            }
          : null,
        reportingAwardId: row.reporting_award_id,
        disbursements: row.disbursements.map((item) => ({
          id: item.id,
          amount: item.amount,
          date: item.disbursement_date,
          notes: item.notes,
        })),
        reports: row.reports.map((item) => ({
          id: item.id,
          periodStart: item.reporting_period_start,
          periodEnd: item.reporting_period_end,
          dueDate: item.due_date,
          submittedDate: item.submitted_date,
        })),
        documents: row.documents.map((item) => ({
          id: item.id,
          name: item.document_type.replaceAll("_", " "),
        })),
      };
    },
    /** Closes an application that is still in its sign-off chain. This cannot be undone. */
    decline(id: number, reason: string) {
      return request<import("zod").infer<typeof mutationSchema>>(
        {
          method: "PATCH",
          path: `/grants/${id}`,
          routeTemplate: "/grants/:id",
          token,
          body: { status: "DECLINED", status_description: reason },
        },
        mutationSchema
      );
    },
    advance(id: number, status: "PREPARED" | "REVIEWED" | "APPROVED") {
      return request<import("zod").infer<typeof mutationSchema>>(
        {
          method: "PATCH",
          path: `/grants/${id}`,
          routeTemplate: "/grants/:id",
          token,
          body: { status },
        },
        mutationSchema
      );
    },
    recordDisbursement(grantId: number, amount: number, date: string, notes?: string) {
      return request<import("zod").infer<typeof mutationSchema>>(
        {
          method: "POST",
          path: "/grants",
          routeTemplate: "/grants",
          token,
          query: { table: "grant_disbursement" },
          body: { grant_id: grantId, amount, disbursement_date: date, notes: notes ?? null },
        },
        mutationSchema
      );
    },
    addGrantPeriod(
      awardId: number,
      input: { periodStart: string; periodEnd: string; dueDate: string }
    ) {
      return request<import("zod").infer<typeof mutationSchema>>(
        {
          method: "POST",
          path: "/grants",
          routeTemplate: "/grants",
          token,
          query: { table: "grant_report" },
          body: {
            grant_award_id: awardId,
            reporting_period_start: input.periodStart,
            reporting_period_end: input.periodEnd,
            due_date: input.dueDate,
          },
        },
        mutationSchema
      );
    },
    downloadPack(id: number) {
      return request<import("zod").infer<typeof packSchema>>(
        {
          method: "GET",
          path: `/grants/${id}`,
          routeTemplate: "/grants/:id",
          token,
          query: { pack: true },
        },
        packSchema
      );
    },
    viewDocument(id: number) {
      return request<import("zod").infer<typeof documentDetailSchema>>(
        {
          method: "GET",
          path: `/grants/${id}`,
          routeTemplate: "/grants/:id",
          token,
          query: { table: "document", download: true },
        },
        documentDetailSchema
      );
    },
    export(query: GrantQuery) {
      return request<import("zod").infer<typeof exportSchema>>(
        {
          method: "GET",
          path: "/grants",
          routeTemplate: "/grants",
          token,
          query: {
            pillarId: query.pillarId,
            status: query.status,
            search: query.search,
            format: "csv",
          },
        },
        exportSchema
      );
    },
  };
}
function bound() {
  return withSessionApi(createGrantsApi);
}
export const grantsApi = {
  async list(query?: GrantQuery) {
    return (await bound()).list(query);
  },
  async countAwaitingSignoff() {
    return (await bound()).countAwaitingSignoff();
  },
  async get(id: number) {
    return (await bound()).get(id);
  },
  async pillars() {
    return (await bound()).pillars();
  },
  async programmes() {
    return (await bound()).programmes();
  },
};
