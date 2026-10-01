import { z } from "zod";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";

const text = z
  .string()
  .nullish()
  .transform((value) => value ?? null);
export const submissionDtoSchema = z.object({
  id: z.number().int(),
  enrollment_id: z.number().int(),
  stage_definition_id: z.number().int(),
  notes: z.string().nullable(),
  stage_event_status: z.string(),
  event_date: z.string(),
  source_channel: z.string(),
  local_ref: z.string().nullable(),
  /** Named by the API, so a card needs no other table. */
  pillar_id: z
    .number()
    .int()
    .nullish()
    .transform((value) => value ?? null),
  pillar_name: text,
  entry_category: text,
  stage_name: text,
  place: text,
  review_status: text,
  /** Photos captured with the submission (`include=documents`). */
  documents: z
    .array(z.object({ id: z.number().int(), document_type: z.string() }))
    .nullish()
    .transform((value) => value ?? []),
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
/** A file captured with a submission (owner_type participant_stage_event). */
export const submissionDocumentSchema = z.object({
  id: z.number().int(),
  owner_type: z.string(),
  owner_id: z.number().int(),
  document_type: z.string(),
  file_url: z.string(),
});
export const submissionDocumentListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(submissionDocumentSchema), z.null()])
);
export const submissionDocumentDetailSchema = createEnvelopeSchema(
  z.union([submissionDocumentSchema, z.null()])
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
