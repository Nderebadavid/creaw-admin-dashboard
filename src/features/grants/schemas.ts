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
  updated_at: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
  /** Named by the API, so a row needs no participant, organisation or project lookup. */
  participant_name: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
  organisation_name: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
  project_name: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
  project_pillar_id: id.nullish().transform((value) => value ?? null),
  reporting_award_id: id.nullish().transform((value) => value ?? null),
});
export const awardSchema = z.object({
  id,
  application_id: id,
  amount_awarded: z.number(),
  currency: z.string(),
  contract_start: z.string().nullable(),
  contract_end: z.string().nullable(),
  grant_lifecycle_status: z.string(),
  contract_document_id: id.nullable(),
});
export const disbursementSchema = z.object({
  id,
  grant_id: id,
  amount: z.number(),
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
export const pillarSchema = z.object({ id, code: z.string(), name: z.string() });
export const applicationListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(applicationSchema), z.null()])
);
/** An application with its award, payments, reporting periods and files (`include=…`). */
export const applicationDetailSchema = createEnvelopeSchema(
  z.union([
    applicationSchema.extend({
      awards: z
        .array(awardSchema)
        .nullish()
        .transform((value) => value ?? []),
      disbursements: z
        .array(disbursementSchema)
        .nullish()
        .transform((value) => value ?? []),
      reports: z
        .array(grantReportSchema)
        .nullish()
        .transform((value) => value ?? []),
      documents: z
        .array(documentSchema)
        .nullish()
        .transform((value) => value ?? []),
    }),
    z.null(),
  ])
);
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
    z.object({
      preparedBy: id.nullable(),
      reviewedBy: id.nullable(),
      approvedBy: id.nullable(),
      /** Each recorded decision, oldest first. */
      history: z
        .array(
          z.object({
            event: z.enum([
              "PREPARED",
              "REVIEWED",
              "APPROVED",
              "DECLINED",
              "SENT_BACK_TO_REVIEWED",
              "SENT_BACK_TO_PREPARED",
              "SENT_BACK_TO_NEW",
            ]),
            byName: z.string().nullable(),
            at: z.string(),
          })
        )
        .default([]),
    }),
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
/** `grant_application.grant_type` values from the database schema. */
export const GRANT_TYPES = ["one_off", "staggered_by_milestone", "asset_grant"] as const;
export const applicationCreateSchema = z.object({
  projectId: id,
  participantId: id,
  requestedAmount: z.number().positive().max(1_000_000_000),
  grantType: z.enum(GRANT_TYPES),
  /** The business or purpose, shown to the officers who sign off. */
  notes: z.string().trim().max(500).optional(),
});
export const sendBackInputSchema = z.object({
  id,
  /** Stored in `status_description`, which holds 255 characters. */
  reason: z.string().trim().min(1).max(255),
});
export const declineInputSchema = z.object({
  id,
  /** Stored in `status_description`, which holds 255 characters. */
  reason: z.string().trim().min(1).max(255),
});
export const disburseInputSchema = z.object({
  applicationId: id,
  amount: z.number().positive(),
  date: z.iso.date(),
  notes: z.string().trim().max(255).optional(),
});
export const updateAwardInputSchema = z.object({
  applicationId: id,
  amount: z.number().positive(),
});
export const updateDisbursementInputSchema = disburseInputSchema.extend({
  disbursementId: id,
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
