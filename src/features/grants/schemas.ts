import { z } from "zod";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";

const id = z.number().int().positive();
export const applicationSchema = z.object({
  id,
  project_id: id,
  participant_id: id.nullable(),
  organisation_id: id.nullable(),
  requested_amount: z.number(),
  grant_type: z.string(),
  application_document_id: id.nullable(),
  notes: z.string().nullable(),
  status: z.string(),
  status_description: z.string().nullable(),
  created_at: z.string(),
});
export const awardSchema = z.object({
  id,
  application_id: id,
  amount_awarded: z.string(),
  currency: z.string(),
  contract_start: z.string().nullable(),
  contract_end: z.string().nullable(),
  grant_lifecycle_status: z.string(),
  contract_document_id: id.nullable(),
});
export const disbursementSchema = z.object({
  id,
  grant_id: id,
  amount: z.string(),
  percentage_of_total: z.number().nullable(),
  disbursement_date: z.string().nullable(),
  notes: z.string().nullable(),
});
export const grantReportSchema = z.object({
  id,
  grant_award_id: id,
  reporting_period_start: z.string(),
  reporting_period_end: z.string(),
  due_date: z.string(),
  submitted_date: z.string().nullable(),
  document_id: id.nullable(),
  notes: z.string().nullable(),
});
export const documentSchema = z.object({
  id,
  owner_type: z.string(),
  owner_id: id,
  document_type: z.string(),
  file_url: z.string(),
});
export const projectSchema = z.object({
  id,
  pillar_id: id,
  name: z.string(),
  donor_id: id.nullable(),
});
export const pillarSchema = z.object({ id, name: z.string() });
export const applicationListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(applicationSchema), z.null()])
);
export const applicationDetailSchema = createEnvelopeSchema(z.union([applicationSchema, z.null()]));
export const awardListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(awardSchema), z.null()])
);
export const disbursementListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(disbursementSchema), z.null()])
);
export const grantReportListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(grantReportSchema), z.null()])
);
export const documentListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(documentSchema), z.null()])
);
export const documentDetailSchema = createEnvelopeSchema(
  z.union([documentSchema.extend({ simulated: z.boolean() }), z.null()])
);
export const projectListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(projectSchema), z.null()])
);
export const pillarListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(pillarSchema), z.null()])
);
export const mutationSchema = createEnvelopeSchema(z.union([z.object({ id }), z.null()]));
export const packSchema = createEnvelopeSchema(
  z.union([z.object({ application_id: id, simulated: z.boolean() }), z.null()])
);
export const signoffSchema = createEnvelopeSchema(
  z.union([
    z.object({ preparedBy: id.nullable(), reviewedBy: id.nullable(), approvedBy: id.nullable() }),
    z.null(),
  ])
);
export const exportSchema = createEnvelopeSchema(
  z.union([
    z.object({ filename: z.string(), content: z.string(), totalItems: z.number() }),
    z.null(),
  ])
);
export const advanceInputSchema = z.object({
  id,
  status: z.enum(["PREPARED", "REVIEWED", "APPROVED"]),
});
export const disburseInputSchema = z.object({
  applicationId: id,
  amount: z.number().positive(),
  date: z.iso.date(),
  notes: z.string().trim().max(255).optional(),
});
export const grantPeriodInputSchema = z
  .object({
    applicationId: id,
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    dueDate: z.iso.date(),
  })
  .refine(
    (value) => value.periodStart <= value.periodEnd && value.periodEnd <= value.dueDate,
    "Check reporting period dates"
  );
export type ApplicationDto = z.infer<typeof applicationSchema>;
export type AwardDto = z.infer<typeof awardSchema>;
export type DisbursementDto = z.infer<typeof disbursementSchema>;
