import { z } from "zod";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";

const positive = z.number().int().positive();
export const participantDtoSchema = z.object({
  id: positive, first_name: z.string(), middle_name: z.string().nullable(), last_name: z.string(),
  id_number: z.string().nullable(), phone_number: z.string().nullable(), date_of_birth: z.string().nullable(),
  gender: z.string().nullable(), ward_id: positive.nullable(), is_consent_given: z.boolean(),
  remarks: z.string().nullable(), status: z.string(), created_at: z.string(), updated_at: z.string(),
});
export const enrollmentDtoSchema = z.object({
  id: positive, participant_id: positive.nullable(), pillar_id: positive, entry_category: z.string(),
  status: z.string(), created_at: z.string(), updated_at: z.string(),
});
export const enrollmentReadDtoSchema = enrollmentDtoSchema.extend({ current_stage: z.string().nullable(), current_stage_date: z.string().nullable() });
export const lookupDtoSchema = z.object({ id: positive, name: z.string(), county_id: positive.optional(), sub_county_id: positive.optional(), code: z.string().optional() });
export const participantListSchema = createEnvelopeSchema(z.union([createPaginatedSchema(participantDtoSchema), z.null()]));
export const participantDetailSchema = createEnvelopeSchema(z.union([participantDtoSchema, z.null()]));
export const enrollmentListSchema = createEnvelopeSchema(z.union([createPaginatedSchema(enrollmentReadDtoSchema), z.null()]));
export const enrollmentDetailSchema = createEnvelopeSchema(z.union([enrollmentReadDtoSchema, z.null()]));
export const lookupListSchema = createEnvelopeSchema(z.union([createPaginatedSchema(lookupDtoSchema), z.null()]));
export const participantMutationSchema = participantDetailSchema;
export const enrollmentMutationSchema = createEnvelopeSchema(z.union([enrollmentDtoSchema, z.null()]));

export const participantRegistrationSchema = z.object({
  firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).optional(), idNumber: z.string().trim().max(40).optional(),
  phoneNumber: z.string().trim().max(30).optional(), dateOfBirth: z.iso.date().optional(),
  gender: z.string().trim().max(20).optional(), wardId: positive.optional(), pillarId: positive,
  consentGiven: z.boolean(), remarks: z.string().trim().optional(),
});
export const participantUpdateSchema = z.object({
  id: positive, firstName: z.string().trim().min(1).max(80).optional(), lastName: z.string().trim().min(1).max(80).optional(),
  phoneNumber: z.string().trim().max(30).nullable().optional(), remarks: z.string().trim().nullable().optional(),
  consentGiven: z.boolean().optional(),
});
export type ParticipantRegistration = z.infer<typeof participantRegistrationSchema>;
export type ParticipantUpdate = z.infer<typeof participantUpdateSchema>;
export type ParticipantDto = z.infer<typeof participantDtoSchema>;
export type EnrollmentDto = z.infer<typeof enrollmentReadDtoSchema>;
