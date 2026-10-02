import { projectCardSchema } from "@/features/projects/schemas";
import { z } from "zod";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";

export const dashboardDtoSchema = createEnvelopeSchema(
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

export const dashboardParticipantSchema = createEnvelopeSchema(
  z.union([
    createPaginatedSchema(
      z.object({
        id: z.number().int(),
        created_at: z.string(),
      })
    ),
    z.null(),
  ])
);

export const dashboardSubmissionSchema = createEnvelopeSchema(
  z.union([
    createPaginatedSchema(
      z.object({
        id: z.number().int(),
        enrollment_id: z.number().int(),
        notes: z.string().nullable(),
        stage_event_status: z.string(),
        event_date: z.string(),
      })
    ),
    z.null(),
  ])
);

export const dashboardAuditSchema = createEnvelopeSchema(
  z.union([
    createPaginatedSchema(
      z.object({
        id: z.number().int(),
        action: z.string(),
        entity_type: z.string(),
        entity_id: z.number().int().nullable().default(null),
        performed_at: z.string(),
        performed_by_name: z.string().nullable().default(null),
        source: z.string().nullable().default(null),
      })
    ),
    z.null(),
  ])
);

export const dashboardEnrollmentSchema = createEnvelopeSchema(
  z.union([
    createPaginatedSchema(
      z.object({
        id: z.number().int(),
        pillar_id: z.number().int(),
        participant_id: z.number().int().nullable().default(null),
        entry_category: z.string().nullable().default(null),
        status: z.string().default("ACTIVE"),
      })
    ),
    z.null(),
  ])
);

const text = z
  .string()
  .nullish()
  .transform((value) => value ?? null);
/** `GET /dashboard?view=overview`: every dashboard panel, computed and scoped by the API. */
export const dashboardOverviewSchema = createEnvelopeSchema(
  z.union([
    z.object({
      participant_count: z.number().int(),
      /** Participants living with a disability, in the same scope and area. */
      pwd_count: z
        .number()
        .int()
        .nullish()
        .transform((value) => value ?? null),
      enrollment_count: z.number().int(),
      /** The period the activity figures cover, inclusive. */
      period: z.object({ from: z.string(), to: z.string() }),
      /** Participants registered in the period, and in the equal-length period before it. */
      new_in_period: z.number().int(),
      previous_period: z.number().int(),
      pending_submissions: z.number().int().nullable(),
      pillars: z.array(
        z.object({
          id: z.number().int(),
          code: z.string(),
          lead_name: text,
          reached: z.number().int(),
          active: z.number().int(),
        })
      ),
      monthly: z.array(
        z.object({
          /** YYYY-MM, one entry per month the period touches. */
          month: z.string().regex(/^\d{4}-\d{2}$/),
          new_count: z.number().int(),
          completed_count: z.number().int(),
        })
      ),
      recent_submissions: z
        .array(
          z.object({
            id: z.number().int(),
            title: text,
            pillar_id: z.number().int().nullable(),
            category: text,
            status: z.string(),
            event_date: z.string(),
          })
        )
        .nullable(),
      projects: z
        .array(projectCardSchema)
        .nullish()
        .transform((value) => value ?? []),
      reports: z
        .object({
          total: z.number().int(),
          overdue: z.array(
            z.object({ title: z.string(), project: z.string(), due_date: z.string() })
          ),
          upcoming: z.array(
            z.object({
              id: z.number().int(),
              key: z.string(),
              title: z.string(),
              project: z.string(),
              status: z.string(),
              period_end: z.string(),
              due_date: z.string(),
            })
          ),
        })
        .nullable(),
      // Absent from an API that predates these panels; null when the caller may not see them.
      referrals: z
        .object({
          open: z.number().int(),
          overdue: z.number().int(),
          overdue_after_days: z.number().int(),
          decided_in_period: z.number().int(),
          accepted_rate: z.number().nullable(),
          by_destination: z.array(
            z.object({
              pillar_id: z.number().int(),
              open: z.number().int(),
              oldest_days: z.number().int(),
            })
          ),
          oldest: z.array(
            z.object({
              id: z.number().int(),
              participant_name: text,
              from_pillar_id: z.number().int(),
              to_pillar_id: z.number().int(),
              destination_name: text,
              raised_on: z.string(),
              age_days: z.number().int(),
            })
          ),
        })
        .nullish()
        .transform((value) => value ?? null),
      funnel: z
        .object({
          pillar_id: z.number().int(),
          code: z.string(),
          pipeline_name: z.string(),
          enrollments: z.number().int(),
          stages: z.array(
            z.object({
              id: z.number().int(),
              step_no: z.number().int(),
              name: z.string(),
              reached: z.number().int(),
            })
          ),
          available: z.array(z.string()),
        })
        .nullish()
        .transform((value) => value ?? null),
      recent_activity: z
        .array(
          z.object({
            id: z.number().int(),
            action: z.string(),
            entity_type: z.string(),
            entity_id: z.number().int().nullable().default(null),
            source: text,
            performed_at: z.string(),
            performed_by_name: text,
          })
        )
        .nullable(),
    }),
    z.null(),
  ])
);
