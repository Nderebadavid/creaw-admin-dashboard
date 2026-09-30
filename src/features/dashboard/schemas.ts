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
