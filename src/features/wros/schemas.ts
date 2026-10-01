import { z } from "zod";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";

const id = z.number().int().positive();
const page = <T extends z.ZodType>(item: T) =>
  createEnvelopeSchema(z.union([createPaginatedSchema(item), z.null()]));

const optionalText = z
  .string()
  .nullish()
  .transform((value) => value ?? null);
const optionalNumber = z
  .number()
  .nullish()
  .transform((value) => value ?? null);
export const organisationDtoSchema = z.object({
  id,
  name: z.string(),
  legal_form: z.string(),
  registration_number: z.string().nullable(),
  ward_id: id.nullable(),
  address: z.string().nullable(),
  // Sensitive: arrives masked (a string) unless revealed.
  has_bank_account: z.union([z.boolean(), z.string()]).nullable(),
  due_diligence_status: z.string(),
  due_diligence_date: z.string().nullable(),
  status: z.string(),
  status_description: optionalText,
  created_at: z.string(),
  updated_at: optionalText,
  /** Named and summarised by the API, so a register row needs no other table. */
  ward_name: optionalText,
  county_name: optionalText,
  enrollment_id: optionalNumber,
  entry_category: optionalText,
  current_stage_index: optionalNumber,
  stage_count: optionalNumber,
  is_contracted: z
    .boolean()
    .nullish()
    .transform((value) => value ?? null),
});
export type OrganisationDto = z.infer<typeof organisationDtoSchema>;
export const organisationListSchema = page(organisationDtoSchema);
export const organisationDetailSchema = createEnvelopeSchema(
  z.union([
    organisationDtoSchema.extend({
      stage_events: z
        .array(
          z.object({
            id,
            stage_definition_id: id,
            stage_event_status: z.string(),
            event_date: z.string(),
          })
        )
        .default([]),
    }),
    z.null(),
  ])
);
export const organisationOptionsSchema = createEnvelopeSchema(
  z.union([z.object({ wards: z.array(z.object({ id, name: z.string() })) }), z.null()])
);
export const mutationSchema = createEnvelopeSchema(
  z.union([z.object({ id }).passthrough(), z.null()])
);

/** Legal forms offered in the field app, stored in organisation.legal_form. */
export const legalForms = {
  cbo: "Community-based organisation",
  ngo: "NGO",
  self_help_group: "Self-help group",
  trust: "Trust",
} as const;
export type LegalForm = keyof typeof legalForms;

/** The field app's "Register organisation" flow, minus what the schema does not store. */
export const organisationRegistrationSchema = z.object({
  name: z.string().trim().min(2).max(200),
  legalForm: z.enum(Object.keys(legalForms) as [LegalForm, ...LegalForm[]]),
  registrationNumber: z.string().trim().max(80).optional(),
  wardId: id.optional(),
  address: z.string().trim().max(255).optional(),
  hasBankAccount: z.boolean(),
  entryCategory: z.string().trim().min(2).max(120),
  /** The representative signed the data-sharing agreement; required, as in the app. */
  dataSharingAgreed: z.literal(true),
});
export type OrganisationRegistration = z.infer<typeof organisationRegistrationSchema>;

export const stageMoveSchema = z.object({
  enrollmentId: id,
  stageId: id,
  notes: z.string().trim().max(1000).optional(),
});
export type StageMove = z.infer<typeof stageMoveSchema>;
