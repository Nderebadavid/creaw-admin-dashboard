/**
 * Typed client for WRO capacity assessments, recommendations and due-diligence checks.
 *
 * `create*Api(client, token)` maps API DTOs into view models and is what tests
 * exercise directly; the exported singleton binds it to the signed-in session
 * for Server Components. Responses are envelope-validated with Zod; the API
 * applies permission and pillar-scope filtering and masks sensitive fields.
 */
import type { ApiClient } from "@/lib/api/client";
import { withSessionApi } from "@/lib/api/session-api";
import { collectPages } from "@/lib/api/pagination";
import {
  assessmentListSchema,
  assessmentDetailSchema,
  scoreListSchema,
  checkListSchema,
  criterionListSchema,
  organisationListSchema,
  instrumentListSchema,
  documentDetailSchema,
  mutationSchema,
  checkSchema,
  type assessmentSchema,
  type scoreSchema,
  type criterionSchema,
  type organisationSchema,
  type AssessmentRecord,
} from "./schemas";
import { createEnvelopeSchema } from "@/lib/api/contracts";
import type { z } from "zod";

type Assessment = z.infer<typeof assessmentSchema>;
type Score = z.infer<typeof scoreSchema>;
type Check = z.infer<typeof checkSchema>;
type Criterion = z.infer<typeof criterionSchema>;
type Organisation = z.infer<typeof organisationSchema>;
export interface AssessmentView {
  id: number;
  organisation: string;
  organisationId: number;
  dueDiligence: string;
  score: number;
  maxScore: number | null;
  scores: { label: string; score: number; max: number | null }[];
  documents: { id: number; name: string; status: string; documentId: number | null }[];
  status: string;
  recommendation: string | null;
  proposedRecommendation: string | null;
  /** The assessor's notes on strengths and gaps. */
  notes: string | null;
  /** The assessor asked for a follow-up visit. */
  followUp: boolean;
  recordedAt: string;
  pillarId: number;
}
/** The choices for a new assessment: which organisation, scored with which instrument. */
export interface AssessmentOptions {
  organisations: { id: number; name: string }[];
  instruments: {
    id: number;
    name: string;
    /** The domains this instrument scores; none for a checklist-only instrument. */
    criteria: { id: number; label: string; max: number | null }[];
  }[];
}
export interface AssessmentPage {
  items: AssessmentView[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
function required<T>(result: { success: boolean; data: T | null; message: string }): T {
  if (!result.success || !result.data) throw new Error(result.message);
  return result.data;
}

export function createAssessmentsApi(client: ApiClient, token: string) {
  const request = <T>(
    input: Parameters<ApiClient["request"]>[0],
    schema: Parameters<ApiClient["request"]>[1]
  ) => client.request(input, schema) as Promise<T>;
  const all = <T>(table: string, schema: Parameters<ApiClient["request"]>[1]) =>
    collectPages<T>(async (page, pageSize) =>
      required(
        await request<{
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
            path: "/assessments",
            routeTemplate: "/assessments",
            token,
            query: { table, page, pageSize },
          },
          schema
        )
      )
    );
  async function decorate(rows: Assessment[]): Promise<AssessmentView[]> {
    const [organisations, scores, checks, criteria] = await Promise.all([
      all<Organisation>("organisation", organisationListSchema),
      all<Score>("organisation_assessment_score", scoreListSchema),
      all<Check>("assessment_document_check", checkListSchema),
      all<Criterion>("assessment_criterion", criterionListSchema),
    ]);
    return rows.map((row) => {
      const organisation = organisations.find((item) => item.id === row.organisation_id);
      const scoreRows = scores
        .filter((item) => item.assessment_id === row.id)
        .map((item) => {
          const criterion = criteria.find((c) => c.id === item.criterion_id);
          if (!criterion) throw new Error("Assessment criterion unavailable");
          return { label: criterion.label, score: item.score ?? 0, max: criterion.max_score };
        });
      return {
        id: row.id,
        organisation: organisation?.name ?? `Organisation #${row.organisation_id}`,
        organisationId: row.organisation_id,
        dueDiligence: organisation?.due_diligence_status ?? "unknown",
        score: scoreRows.length
          ? Math.round(
              (scoreRows.reduce((sum, item) => sum + item.score, 0) / scoreRows.length) * 10
            ) / 10
          : 0,
        maxScore:
          scoreRows.length && scoreRows.every((item) => item.max !== null)
            ? Math.round(
                (scoreRows.reduce((sum, item) => sum + item.max!, 0) / scoreRows.length) * 10
              ) / 10
            : null,
        scores: scoreRows,
        documents: checks
          .filter((item) => item.assessment_id === row.id)
          .map((item) => ({
            id: item.id,
            name: item.document_name,
            status: item.document_check_status,
            documentId: item.document_id,
          })),
        status: row.status,
        recommendation: row.overall_recommendation,
        proposedRecommendation: row.status_description,
        notes: row.section_comments?.assessor_notes ?? null,
        followUp: row.section_comments?.follow_up_visit ?? false,
        recordedAt: row.created_at,
        pillarId: 5,
      };
    });
  }
  return {
    async options(): Promise<AssessmentOptions> {
      const [organisations, instruments, criteria] = await Promise.all([
        all<Organisation>("organisation", organisationListSchema),
        all<{ id: number; name: string }>("assessment_instrument", instrumentListSchema),
        all<Criterion>("assessment_criterion", criterionListSchema),
      ]);
      return {
        organisations: organisations.map(({ id, name }) => ({ id, name })),
        instruments: instruments.map(({ id, name }) => ({
          id,
          name,
          criteria: criteria
            .filter((item) => item.instrument_id === id)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((item) => ({ id: item.id, label: item.label, max: item.max_score })),
        })),
      };
    },
    async list(page = 1, pageSize = 25): Promise<AssessmentPage> {
      const result = await request<z.infer<typeof assessmentListSchema>>(
        {
          method: "GET",
          path: "/assessments",
          routeTemplate: "/assessments",
          token,
          query: { page, pageSize },
        },
        assessmentListSchema
      );
      const data = required(result);
      return { ...data, items: await decorate(data.items) };
    },
    async get(id: number): Promise<AssessmentView | null> {
      const result = await request<z.infer<typeof assessmentDetailSchema>>(
        { method: "GET", path: `/assessments/${id}`, routeTemplate: "/assessments/:id", token },
        assessmentDetailSchema
      );
      return result.success && result.data ? (await decorate([result.data]))[0] : null;
    },
    create(input: { organisationId: number; instrumentId: number; recommendation?: string }) {
      return request<z.infer<typeof mutationSchema>>(
        {
          method: "POST",
          path: "/assessments",
          routeTemplate: "/assessments",
          token,
          body: {
            organisation_id: input.organisationId,
            instrument_id: input.instrumentId,
            ...(input.recommendation ? { overall_recommendation: input.recommendation } : {}),
          },
        },
        mutationSchema
      );
    },
    /**
     * A scored assessment: the assessment row, one score per domain, then a
     * not-yet-obtained check for each due-diligence document to collect.
     * Stops at the first refused write and returns it.
     */
    async record(input: AssessmentRecord, withChecks: boolean) {
      const post = (table: string | undefined, body: Record<string, unknown>) =>
        request<z.infer<typeof mutationSchema>>(
          {
            method: "POST",
            path: "/assessments",
            routeTemplate: "/assessments",
            token,
            query: table ? { table } : undefined,
            body,
          },
          mutationSchema
        );
      const created = await post(undefined, {
        organisation_id: input.organisationId,
        instrument_id: input.instrumentId,
        section_comments: { assessor_notes: input.notes || null, follow_up_visit: input.followUp },
      });
      if (!created.success || !created.data) return created;
      const assessmentId = created.data.id;
      for (const score of input.scores) {
        const saved = await post("organisation_assessment_score", {
          assessment_id: assessmentId,
          criterion_id: score.criterionId,
          score: score.score,
        });
        if (!saved.success) return saved;
      }
      if (withChecks)
        for (const name of input.documents) {
          const saved = await post("assessment_document_check", {
            assessment_id: assessmentId,
            document_name: name,
            document_check_status: "not_obtained",
          });
          if (!saved.success) return saved;
        }
      return created;
    },
    // TODO(schema): there is no separate recommendation/draft column; status_description holds a proposed value until an approver writes overall_recommendation.
    recommend(id: number, recommendation: string) {
      return request<z.infer<typeof mutationSchema>>(
        {
          method: "PATCH",
          path: `/assessments/${id}`,
          routeTemplate: "/assessments/:id",
          token,
          body: { status_description: recommendation },
        },
        mutationSchema
      );
    },
    approve(id: number, recommendation: string) {
      return request<z.infer<typeof mutationSchema>>(
        {
          method: "PATCH",
          path: `/assessments/${id}`,
          routeTemplate: "/assessments/:id",
          token,
          body: { overall_recommendation: recommendation },
        },
        mutationSchema
      );
    },
    viewDocument(id: number) {
      return request<z.infer<typeof documentDetailSchema>>(
        {
          method: "GET",
          path: `/assessments/${id}`,
          routeTemplate: "/assessments/:id",
          token,
          query: { table: "document", download: true },
        },
        documentDetailSchema
      );
    },
    async attach(checkId: number, fileUrl: string) {
      const check = await request<z.infer<typeof createEnvelopeSchemaWrapper>>(
        {
          method: "GET",
          path: `/assessments/${checkId}`,
          routeTemplate: "/assessments/:id",
          token,
          query: { table: "assessment_document_check" },
        },
        createEnvelopeSchemaWrapper
      );
      if (!check.success || !check.data)
        return { resultCode: check.resultCode, success: false, message: check.message, data: null };
      const document = await request<z.infer<typeof mutationSchema>>(
        {
          method: "POST",
          path: "/assessments",
          routeTemplate: "/assessments",
          token,
          query: { table: "document" },
          body: {
            owner_type: "organisation_assessment",
            owner_id: check.data.assessment_id,
            document_type: check.data.document_name
              .toLowerCase()
              .replaceAll(/[^a-z0-9]+/g, "_")
              .slice(0, 60),
            file_url: fileUrl,
          },
        },
        mutationSchema
      );
      if (!document.success || !document.data) return document;
      return request<z.infer<typeof mutationSchema>>(
        {
          method: "PATCH",
          path: `/assessments/${checkId}`,
          routeTemplate: "/assessments/:id",
          token,
          query: { table: "assessment_document_check" },
          body: { document_id: document.data.id, document_check_status: "obtained" },
        },
        mutationSchema
      );
    },
  };
}
const createEnvelopeSchemaWrapper = createEnvelopeSchema(checkSchema.nullable());
function bound() {
  return withSessionApi(createAssessmentsApi);
}
export const assessmentsApi = {
  async options() {
    return (await bound()).options();
  },
  async list(page?: number, pageSize?: number) {
    return (await bound()).list(page, pageSize);
  },
  async get(id: number) {
    return (await bound()).get(id);
  },
};
