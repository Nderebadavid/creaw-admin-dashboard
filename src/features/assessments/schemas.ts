import { z } from "zod";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";
const id = z.number().int().positive();
export const assessmentSchema = z.object({
  id,
  organisation_id: id,
  instrument_id: id,
  donor_id: id.nullable(),
  overall_recommendation: z.string().nullable(),
  status_description: z.string().nullable(),
  status: z.string(),
  recorded_by: id.nullable(),
  created_at: z.string(),
  /** Assessor notes and whether a follow-up visit is needed, as recorded in the field. */
  section_comments: z
    .object({
      assessor_notes: z.string().nullable().optional(),
      follow_up_visit: z.boolean().optional(),
    })
    .nullable()
    .optional()
    .catch(null),
});
export const scoreSchema = z.object({
  id,
  assessment_id: id,
  criterion_id: id,
  score: z.number().nullable(),
  notes: z.string().nullable(),
});
export const checkSchema = z.object({
  id,
  assessment_id: id,
  document_name: z.string(),
  document_check_status: z.string(),
  document_id: id.nullable(),
  notes: z.string().nullable(),
});
export const criterionSchema = z.object({
  id,
  instrument_id: id,
  section: z.string(),
  label: z.string(),
  max_score: z.number().nullable(),
  sort_order: z.number(),
});
export const organisationSchema = z.object({
  id,
  name: z.string(),
  due_diligence_status: z.string(),
});
export const instrumentSchema = z.object({ id, name: z.string() });
export const instrumentListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(instrumentSchema), z.null()])
);
export const assessmentListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(assessmentSchema), z.null()])
);
export const assessmentDetailSchema = createEnvelopeSchema(z.union([assessmentSchema, z.null()]));
export const scoreListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(scoreSchema), z.null()])
);
export const checkListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(checkSchema), z.null()])
);
export const criterionListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(criterionSchema), z.null()])
);
export const organisationListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(organisationSchema), z.null()])
);
export const documentDetailSchema = createEnvelopeSchema(
  z.union([
    z.object({
      id,
      owner_type: z.string(),
      owner_id: id,
      document_type: z.string(),
      file_url: z.string(),
      simulated: z.boolean(),
    }),
    z.null(),
  ])
);
export const mutationSchema = createEnvelopeSchema(z.union([z.object({ id }), z.null()]));
export const assessmentCreateSchema = z.object({
  organisationId: id,
  instrumentId: id,
  recommendation: z.string().trim().max(60).optional(),
});
/** The due-diligence documents an assessment can ask the organisation for. */
export const dueDiligenceDocuments = [
  "Registration certificate",
  "Audited accounts",
  "Constitution",
  "Board member list",
  "Safeguarding policy",
  "Bank reference letter",
] as const;
/** A scored assessment, as the field app's assessment form records it. */
export const assessmentRecordSchema = z.object({
  organisationId: id,
  instrumentId: id,
  scores: z.array(z.object({ criterionId: id, score: z.number().int().min(1).max(5) })).max(50),
  notes: z.string().trim().max(2000).optional(),
  followUp: z.boolean(),
  documents: z.array(z.enum(dueDiligenceDocuments)).max(dueDiligenceDocuments.length),
});
export type AssessmentRecord = z.infer<typeof assessmentRecordSchema>;
export const recommendationSchema = z.object({
  id,
  recommendation: z.string().trim().min(1).max(60),
});
export const attachSchema = z.object({
  checkId: id,
  fileUrl: z
    .string()
    .max(500)
    .refine((value) => value.startsWith("mock://") || /^https:\/\//.test(value)),
});
