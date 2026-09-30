import { z } from "zod";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";

const id = z.number().int().positive();
const page = <T extends z.ZodType>(item: T) =>
  createEnvelopeSchema(z.union([createPaginatedSchema(item), z.null()]));

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
  created_at: z.string(),
});
export type OrganisationDto = z.infer<typeof organisationDtoSchema>;
export const organisationListSchema = page(organisationDtoSchema);
export const enrollmentListSchema = page(
  z.object({
    id,
    organisation_id: id.nullable(),
    entry_category: z.string(),
    status: z.string(),
  })
);
export const pipelineListSchema = page(z.object({ id, pillar_id: id }));
export const stageListSchema = page(
  z.object({ id, pipeline_id: id, step_no: z.number().int(), name: z.string() })
);
export const stageEventListSchema = page(
  z.object({
    id,
    enrollment_id: id,
    stage_definition_id: id,
    stage_event_status: z.string(),
    event_date: z.string(),
    source_channel: z.string(),
    notes: z.string().nullable(),
  })
);
export const lookupListSchema = page(
  z.object({ id, name: z.string(), sub_county_id: id.optional(), county_id: id.optional() })
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
