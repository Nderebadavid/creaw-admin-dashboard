import { z } from "zod";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";

export const submissionDtoSchema = z.object({
  id: z.number().int(),
  enrollment_id: z.number().int(),
  stage_definition_id: z.number().int(),
  notes: z.string().nullable(),
  stage_event_status: z.string(),
  event_date: z.string(),
  source_channel: z.string(),
  local_ref: z.string().nullable(),
});
export const submissionListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(submissionDtoSchema), z.null()])
);
export const submissionDetailSchema = createEnvelopeSchema(
  z.union([submissionDtoSchema, z.null()])
);
export const enrollmentLookupSchema = createEnvelopeSchema(
  z.union([
    createPaginatedSchema(
      z.object({
        id: z.number().int(),
        pillar_id: z.number().int(),
        participant_id: z.number().int().nullable().default(null),
        entry_category: z.string(),
      })
    ),
    z.null(),
  ])
);
/** Stage names, so a card says what was captured ("Intake", "Health talk"). */
export const stageLookupSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(z.object({ id: z.number().int(), name: z.string() })), z.null()])
);
/** A participant's ward, for the card's place line. */
export const participantPlaceSchema = createEnvelopeSchema(
  z.union([
    createPaginatedSchema(
      z.object({ id: z.number().int(), ward_id: z.number().int().nullable().default(null) })
    ),
    z.null(),
  ])
);
/** Wards, sub-counties and counties, to turn a ward into "Ward · County". */
export const placeLookupSchema = createEnvelopeSchema(
  z.union([
    createPaginatedSchema(
      z.object({
        id: z.number().int(),
        name: z.string(),
        sub_county_id: z.number().int().optional(),
        county_id: z.number().int().optional(),
      })
    ),
    z.null(),
  ])
);
export const enrollmentDetailSchema = createEnvelopeSchema(
  z.union([
    z.object({
      id: z.number().int(),
      pillar_id: z.number().int(),
      participant_id: z.number().int().nullable().default(null),
      entry_category: z.string(),
    }),
    z.null(),
  ])
);
export const submissionMutationSchema = createEnvelopeSchema(
  z.union([submissionDtoSchema, z.null()])
);
export const reviewInputSchema = z.object({
  id: z.number().int().positive(),
  decision: z.enum(["approve", "flag"]),
});
export type SubmissionDto = z.infer<typeof submissionDtoSchema>;
