import { z } from "zod";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";

const positive = z.number().int().positive();
const optionalText = z
  .string()
  .nullish()
  .transform((value) => value ?? null);
export const enrollmentDtoSchema = z.object({
  id: positive,
  participant_id: positive.nullable(),
  pillar_id: positive,
  entry_category: z.string(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export const enrollmentReadDtoSchema = enrollmentDtoSchema.extend({
  current_stage: z.string().nullable(),
  current_stage_date: z.string().nullable(),
});
export const participantDtoSchema = z.object({
  id: positive,
  first_name: z.string(),
  middle_name: z.string().nullable(),
  last_name: z.string(),
  id_number: z.string().nullable(),
  id_number_type: optionalText,
  phone_number: z.string().nullable(),
  date_of_birth: z.string().nullable(),
  gender: z.string().nullable(),
  ward_id: positive.nullable(),
  is_consent_given: z.boolean(),
  is_person_with_disability: z.boolean().default(false),
  is_refugee: z.boolean().default(false),
  remarks: z.string().nullable(),
  status: z.string(),
  status_description: optionalText,
  created_at: z.string(),
  updated_at: z.string(),
  /** Placed and summarised by the API, so a registry row needs no other table. */
  ward_name: optionalText,
  county_id: positive.nullish().transform((value) => value ?? null),
  county_name: optionalText,
  current_stage_name: optionalText,
  /** SRHR curriculum progress, derived from attendance; null unless the caller may see it. */
  curriculum_done: z
    .number()
    .int()
    .nullish()
    .transform((value) => value ?? null),
  curriculum_total: z
    .number()
    .int()
    .nullish()
    .transform((value) => value ?? null),
  curriculum_last_attended: optionalText,
  curriculum_behind: z
    .boolean()
    .nullish()
    .transform((value) => value ?? null),
  /** The enrollments in pillars the caller may view (`include=enrollments`). */
  enrollments: z
    .array(enrollmentReadDtoSchema)
    .nullish()
    .transform((value) => value ?? []),
});
/** `GET /participants/:id?include=curriculum,curriculum_milestones`. */
export const participantCurriculumSchema = createEnvelopeSchema(
  z.union([
    z.object({
      curriculum: z
        .array(
          z.object({
            id: positive,
            name: z.string(),
            activity_type_name: z.string(),
            sequence_no: z.number().int(),
            attended_date: z.string().nullable(),
          })
        )
        .nullish()
        .transform((value) => value ?? []),
      curriculum_milestones: z
        .array(z.object({ id: positive, name: z.string(), reached_at: z.string().nullable() }))
        .nullish()
        .transform((value) => value ?? []),
    }),
    z.null(),
  ])
);
export const lookupDtoSchema = z.object({
  id: positive,
  name: z.string(),
  county_id: positive.optional(),
  sub_county_id: positive.optional(),
  code: z.string().optional(),
});
export const participantListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(participantDtoSchema), z.null()])
);
export const participantDetailSchema = createEnvelopeSchema(
  z.union([participantDtoSchema, z.null()])
);
export const enrollmentListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(enrollmentReadDtoSchema), z.null()])
);
export const enrollmentDetailSchema = createEnvelopeSchema(
  z.union([enrollmentReadDtoSchema, z.null()])
);
export const lookupListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(lookupDtoSchema), z.null()])
);
/** `GET /lookups?tables=pillar,county,ward`: several lookup tables in one call. */
export const catalogSchema = createEnvelopeSchema(
  z.union([
    z.object({
      tables: z.object({
        pillar: z.array(lookupDtoSchema),
        county: z.array(lookupDtoSchema),
        ward: z.array(
          lookupDtoSchema.extend({ county_id: positive.nullish().transform((v) => v ?? undefined) })
        ),
      }),
      denied: z.array(z.string()),
      version: z.string(),
    }),
    z.null(),
  ])
);
export const participantMutationSchema = participantDetailSchema;
export const enrollmentMutationSchema = createEnvelopeSchema(
  z.union([enrollmentDtoSchema, z.null()])
);

export const participantRegistrationSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).optional(),
  idNumber: z.string().trim().max(40).optional(),
  phoneNumber: z.string().trim().max(30).optional(),
  dateOfBirth: z.iso.date().optional(),
  gender: z.string().trim().max(20).optional(),
  wardId: positive.optional(),
  pillarId: positive,
  consentGiven: z.boolean(),
  disability: z.boolean().default(false),
  refugee: z.boolean().default(false),
  remarks: z.string().trim().optional(),
});
export const participantUpdateSchema = z.object({
  id: positive,
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  phoneNumber: z.string().trim().max(30).nullable().optional(),
  remarks: z.string().trim().nullable().optional(),
  consentGiven: z.boolean().optional(),
  // Identity details: changing any of these needs PARTICIPANT_RECORD_MANAGE.
  middleName: z.string().trim().max(80).nullable().optional(),
  idNumber: z.string().trim().max(40).nullable().optional(),
  dateOfBirth: z.iso.date().nullable().optional(),
  gender: z.string().trim().max(20).nullable().optional(),
  wardId: positive.nullable().optional(),
  disability: z.boolean().optional(),
  refugee: z.boolean().optional(),
});
/** Update fields that correct identity details recorded at registration. */
export const PARTICIPANT_IDENTITY_KEYS = [
  "middleName",
  "idNumber",
  "dateOfBirth",
  "gender",
  "wardId",
  "disability",
  "refugee",
] as const;
/** Disability and refugee status default to false when left out. */
export type ParticipantRegistration = z.input<typeof participantRegistrationSchema>;
export type ParticipantUpdate = z.infer<typeof participantUpdateSchema>;
export type ParticipantDto = z.infer<typeof participantDtoSchema>;
export type EnrollmentDto = z.infer<typeof enrollmentReadDtoSchema>;

/** A participant as a picker lists them: a name and the ward the API names. */
export const participantPickerSchema = createEnvelopeSchema(
  z.union([
    createPaginatedSchema(
      z.object({
        id: z.number().int(),
        first_name: z.string(),
        last_name: z.string(),
        ward_name: z.string().nullish(),
      })
    ),
    z.null(),
  ])
);
