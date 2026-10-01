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
      enrollment_count: z.number().int(),
      new_this_quarter: z.number().int(),
      previous_quarter: z.number().int(),
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
          month: z.number().int().min(1).max(12),
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
