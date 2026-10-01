import { z } from "zod";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";

const id = z.number().int().positive();
const text = z
  .string()
  .nullish()
  .transform((value) => value ?? null);
const count = z
  .number()
  .nullish()
  .transform((value) => value ?? null);

/** A donor as `GET /donors` returns it, with project figures derived for the caller. */
export const donorDtoSchema = z.object({
  id,
  name: z.string(),
  notes: text,
  status: z.string(),
  status_description: text,
  created_at: z.string(),
  updated_at: z.string(),
  /** Projects in pillars the caller can see; money follows their award access. */
  projects_count: count,
  active_projects_count: count,
  awarded_total: count,
});
export type DonorDto = z.infer<typeof donorDtoSchema>;

export const donorListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(donorDtoSchema), z.null()])
);

/** `GET /donors/:id?include=projects`. */
export const donorDetailSchema = createEnvelopeSchema(
  z.union([
    donorDtoSchema.extend({
      projects: z
        .array(
          z.object({
            id,
            name: z.string(),
            pillar_id: id,
            pillar_name: text,
            status: z.string(),
            end_date: text,
          })
        )
        .nullish()
        .transform((value) => value ?? []),
    }),
    z.null(),
  ])
);

export const donorMutationSchema = createEnvelopeSchema(z.union([z.object({ id }), z.null()]));

export const donorInputSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(1).max(160),
  notes: z.string().trim().max(2000).nullable().optional(),
  /** Edits only. */
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  statusDescription: z.string().trim().max(255).nullable().optional(),
});
export type DonorInput = z.infer<typeof donorInputSchema>;
export const donorStatusInputSchema = z.object({
  id,
  status: z.enum(["ACTIVE", "INACTIVE"]),
  reason: z.string().trim().max(255).optional(),
});
export const donorDeleteInputSchema = z.object({ id });
