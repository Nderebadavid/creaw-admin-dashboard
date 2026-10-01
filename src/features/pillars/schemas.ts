import { z } from "zod";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";

export const pillarCodeSchema = z.enum(["vawg", "wee", "srhr", "leadership", "wros", "skilling"]);
export type PillarCode = z.infer<typeof pillarCodeSchema>;
export const pillarDashboardSchema = createEnvelopeSchema(
  z.union([
    z.object({
      pillars: z.array(
        z.object({
          id: z.number().int(),
          code: z.string(),
          name: z.string(),
          lead_user_id: z.number().nullable(),
        })
      ),
      participantCount: z.number().int(),
      enrollmentCount: z.number().int(),
    }),
    z.null(),
  ])
);
const optionalText = z
  .string()
  .nullish()
  .transform((value) => value ?? null);
export const pillarEnrollmentSchema = z.object({
  id: z.number().int(),
  pillar_id: z.number().int(),
  participant_id: z.number().int().nullable(),
  organisation_id: z.number().int().nullable(),
  entry_category: z.string(),
  status: z.string(),
  status_description: optionalText,
  created_at: optionalText,
  updated_at: z.string(),
  /** The person or organisation enrolled, named by the API. */
  record_name: optionalText,
});

const count = z.number().nullable();
/** `GET /pillars/:pillar/summary`: header, pipeline stage counts, where people live, and cards. */
export const pillarSummarySchema = createEnvelopeSchema(
  z.union([
    z.object({
      pillar: z.object({
        id: z.number().int(),
        code: z.string(),
        name: z.string(),
        lead_user_id: z.number().nullable(),
        lead_name: z.string().nullable(),
      }),
      pipeline: z
        .object({
          id: z.number().int(),
          name: z.string(),
          stages: z.array(
            z.object({
              id: z.number().int(),
              step_no: z.number().int(),
              name: z.string(),
              count,
            })
          ),
        })
        .nullable(),
      enrollments: z
        .object({
          total: z.number().int(),
          active: z.number().int(),
          counties: z.array(z.string()),
        })
        .nullable(),
      cards: z.object({
        vawg: z
          .object({
            survivors: z.number(),
            open_cases: z.number(),
            concluded: z.number(),
            counselling_sessions: count,
            counselling_this_quarter: count,
          })
          .nullable(),
        sessions: z
          .object({
            period: z.enum(["quarter", "year", "all"]),
            summary: z.custom<import("@/features/sessions/model").SessionSummary>(),
            coverage: z.custom<import("@/features/sessions/model").TypeCoverage[]>(),
          })
          .nullable(),
        trainees: z
          .object({
            enrolled: z.number(),
            completed: z.number(),
            dropped_out: z.number(),
            completion_rate: count,
            in_work: z.number(),
            in_work_rate: count,
            recommended: z.number(),
            accepted_by_wee: z.number(),
          })
          .nullable(),
      }),
    }),
    z.null(),
  ])
);
export type PillarSummaryDto = NonNullable<z.infer<typeof pillarSummarySchema>["data"]>;
export const pillarEnrollmentListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(pillarEnrollmentSchema), z.null()])
);
export const pillarMutationSchema = createEnvelopeSchema(
  z.union([pillarEnrollmentSchema, z.null()])
);
export const pillarDomainMutationSchema = createEnvelopeSchema(
  z.union([z.object({ id: z.number().int() }).passthrough(), z.null()])
);
export const pillarPipelineSchema = createEnvelopeSchema(
  z.union([
    createPaginatedSchema(
      z.object({ id: z.number().int(), pillar_id: z.number().int(), name: z.string() })
    ),
    z.null(),
  ])
);
export const pillarStageSchema = createEnvelopeSchema(
  z.union([
    createPaginatedSchema(
      z.object({
        id: z.number().int(),
        pipeline_id: z.number().int(),
        step_no: z.number().int(),
        name: z.string(),
      })
    ),
    z.null(),
  ])
);
export const pillarStageEventSchema = createEnvelopeSchema(
  z.union([
    createPaginatedSchema(
      z.object({
        id: z.number().int(),
        enrollment_id: z.number().int(),
        stage_definition_id: z.number().int(),
        stage_event_status: z.string(),
      })
    ),
    z.null(),
  ])
);
export const createPillarRecordSchema = z.object({
  code: pillarCodeSchema,
  participantId: z.number().int().positive(),
  entryCategory: z.string().trim().min(2).max(120),
});
export const updatePillarRecordSchema = z.object({
  code: pillarCodeSchema,
  id: z.number().int().positive(),
  entryCategory: z.string().trim().min(2).max(120),
});
const positive = z.number().int().positive();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const createDomainSchema = z.discriminatedUnion("code", [
  z.object({
    code: z.literal("vawg"),
    enrollmentId: positive,
    caseTypeId: positive,
    openedDate: date,
  }),
  z.object({
    code: z.literal("wee"),
    projectId: positive,
    participantId: positive,
    requestedAmount: z.number().positive(),
    grantType: z.string().trim().min(2).max(30),
  }),
  z.object({
    code: z.literal("srhr"),
    activityTypeId: positive,
    sessionDate: date,
    topic: z.string().trim().min(2).max(200),
    venue: z.string().trim().min(2).max(160),
  }),
  z.object({
    code: z.literal("skilling"),
    enrollmentId: positive,
    pathway: z.string().trim().min(2).max(30),
    courseName: z.string().trim().min(2).max(160),
    startDate: date,
  }),
  z.object({
    code: z.literal("wros"),
    name: z.string().trim().min(2).max(200),
    legalForm: z.string().trim().min(2).max(30),
    entryCategory: z.string().trim().min(2).max(120),
  }),
]);
