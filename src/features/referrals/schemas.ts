import { z } from "zod";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";

const positive = z.number().int().positive();
export const referralDtoSchema = z.object({
  id: positive,
  enrollment_id: positive,
  from_pillar_id: positive,
  to_pillar_id: positive,
  to_project_id: positive.nullable(),
  to_partner_institution_id: positive.nullable(),
  trigger_reason: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  is_deleted: z.boolean(),
});
export const referralReadDtoSchema = referralDtoSchema.extend({
  participant_summary: z.object({ id: positive, name: z.string() }).nullable(),
  destination_name: z.string().nullable(),
  /** Named by the API, so a row needs no pillar lookup. */
  from_pillar_name: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
  to_pillar_name: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
  destination_label: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
  /** Officer (or "System (background job)") who created the referral, from the audit log. */
  referred_by_name: z.string().nullable().default(null),
});
export const referralListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(referralReadDtoSchema), z.null()])
);
export const referralDetailSchema = createEnvelopeSchema(
  z.union([referralReadDtoSchema, z.null()])
);
export const referralMutationSchema = createEnvelopeSchema(z.union([referralDtoSchema, z.null()]));
export const referralDestinationCatalogSchema = createEnvelopeSchema(
  z.union([
    z.object({
      internalPillarIds: z.array(positive),
      partnerInstitutions: z.array(z.object({ id: positive, name: z.string() })),
    }),
    z.null(),
  ])
);
export const referralCreateSchema = z.object({
  enrollmentId: positive,
  fromPillarId: positive,
  toPillarId: positive,
  partnerInstitutionId: positive.optional(),
  reason: z.string().trim().min(2),
  notes: z.string().trim().optional(),
});
export const referralDecisionSchema = z.object({
  id: positive,
  decision: z.enum(["ACCEPTED", "DECLINED"]),
  note: z.string().trim().optional(),
});
export const referralEditSchema = z.object({ id: positive, reason: z.string().trim().min(2) });
export type ReferralDto = z.infer<typeof referralReadDtoSchema>;
export type ReferralCreate = z.infer<typeof referralCreateSchema>;
export type ReferralDestinationCatalog = NonNullable<
  z.infer<typeof referralDestinationCatalogSchema>["data"]
>;

/** An enrollment a referral can be made from, as the API lists them. */
export const referralOriginListSchema = createEnvelopeSchema(
  z.union([
    z.object({
      items: z.array(
        z.object({
          enrollment_id: positive,
          pillar_id: positive,
          participant: z.string(),
          category: z.string(),
        })
      ),
    }),
    z.null(),
  ])
);
