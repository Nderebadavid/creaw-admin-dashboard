import { z } from "zod";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";

export const pillarCodeSchema = z.enum(["vawg", "wee", "srhr", "leadership", "wros", "skilling"]);
export type PillarCode = z.infer<typeof pillarCodeSchema>;
export const pillarDashboardSchema = createEnvelopeSchema(z.union([z.object({
  pillars: z.array(z.object({ id: z.number().int(), code: z.string(), name: z.string(), lead_user_id: z.number().nullable() })),
  participantCount: z.number().int(), enrollmentCount: z.number().int(),
}), z.null()]));
export const pillarEnrollmentSchema = z.object({
  id: z.number().int(), pillar_id: z.number().int(), participant_id: z.number().int().nullable(),
  organisation_id: z.number().int().nullable(), entry_category: z.string(), status: z.string(), updated_at: z.string(),
});
export const pillarEnrollmentListSchema = createEnvelopeSchema(z.union([createPaginatedSchema(pillarEnrollmentSchema), z.null()]));
export const pillarMutationSchema = createEnvelopeSchema(z.union([pillarEnrollmentSchema, z.null()]));
export const pillarPipelineSchema = createEnvelopeSchema(z.union([createPaginatedSchema(z.object({ id: z.number().int(), pillar_id: z.number().int(), name: z.string() })), z.null()]));
export const pillarStageSchema = createEnvelopeSchema(z.union([createPaginatedSchema(z.object({ id: z.number().int(), pipeline_id: z.number().int(), step_no: z.number().int(), name: z.string() })), z.null()]));
export const createPillarRecordSchema = z.object({ code: pillarCodeSchema, participantId: z.number().int().positive(), entryCategory: z.string().trim().min(2).max(120) });
export const updatePillarRecordSchema = z.object({ code: pillarCodeSchema, id: z.number().int().positive(), entryCategory: z.string().trim().min(2).max(120) });
