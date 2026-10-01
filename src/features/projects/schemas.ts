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

/** A project in a pillar or dashboard summary: the few fields a panel shows. */
export const projectCardSchema = z.object({
  id,
  name: z.string(),
  pillar_id: id,
  donor_name: text,
  end_date: text,
  applications_count: count,
  awarded_total: count,
  reports_overdue: count,
});
export type ProjectCard = z.infer<typeof projectCardSchema>;

/** A project as `GET /projects` returns it, with donor, pillar and grant figures derived by the API. */
export const projectDtoSchema = z.object({
  id,
  pillar_id: id,
  name: z.string(),
  notes: text,
  donor_id: id.nullish().transform((value) => value ?? null),
  start_date: text,
  end_date: text,
  status: z.string(),
  status_description: text,
  created_at: z.string(),
  updated_at: z.string(),
  pillar_name: text,
  donor_name: text,
  /** Grant figures follow the caller's grants in the pillar; null when they may not see them. */
  applications_count: count,
  awards_count: count,
  awarded_total: count,
  disbursed_total: count,
  reports_overdue: count,
});
export type ProjectDto = z.infer<typeof projectDtoSchema>;

export const projectListSchema = createEnvelopeSchema(
  z.union([createPaginatedSchema(projectDtoSchema), z.null()])
);

/** `GET /projects/:id?include=applications,awards,reports`. */
export const projectDetailSchema = createEnvelopeSchema(
  z.union([
    projectDtoSchema.extend({
      applications: z
        .array(
          z.object({
            id,
            participant_name: text,
            organisation_name: text,
            requested_amount: z.number(),
            grant_type: z.string(),
            status: z.string(),
          })
        )
        .nullish()
        .transform((value) => value ?? []),
      awards: z
        .array(z.object({ id, application_id: id, amount_awarded: z.number() }))
        .nullish()
        .transform((value) => value ?? []),
      disbursements: z
        .array(
          z.object({
            id,
            grant_id: id,
            amount: z.number(),
            disbursement_date: text,
            notes: text,
          })
        )
        .nullish()
        .transform((value) => value ?? []),
      reports: z
        .array(
          z.object({
            id,
            reporting_period_start: z.string(),
            reporting_period_end: z.string(),
            due_date: z.string(),
            submitted_date: text,
          })
        )
        .nullish()
        .transform((value) => value ?? []),
    }),
    z.null(),
  ])
);

export const projectMutationSchema = createEnvelopeSchema(z.union([z.object({ id }), z.null()]));

const lookup = z.object({ id, name: z.string() });
/** `GET /lookups?tables=pillar,donor`. */
export const projectOptionsSchema = createEnvelopeSchema(
  z.union([
    z.object({ tables: z.object({ pillar: z.array(lookup), donor: z.array(lookup) }) }),
    z.null(),
  ])
);

const date = z.iso.date();
export const projectInputSchema = z
  .object({
    id: id.optional(),
    pillarId: id,
    name: z.string().trim().min(1).max(200),
    donorId: id.nullable().optional(),
    startDate: date.nullable().optional(),
    endDate: date.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    /** Edits only: the record's own status and why it has it. */
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    statusDescription: z.string().trim().max(255).nullable().optional(),
  })
  .refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
    message: "A project cannot end before it starts",
    path: ["endDate"],
  });
export type ProjectInput = z.infer<typeof projectInputSchema>;

export const projectStatusInputSchema = z.object({
  id,
  status: z.enum(["ACTIVE", "INACTIVE"]),
  /** Why the project is being deactivated; optional, cleared on reactivation. */
  reason: z.string().trim().max(255).optional(),
});
export const projectDeleteInputSchema = z.object({ id });
