import { z } from "zod";
import { createEnvelopeSchema, createPaginatedSchema } from "@/lib/api/contracts";

const id = z.number().int().positive();
export const auditRowSchema = z.object({
  id,
  entity_type: z.string().nullable(), entity_id: id.nullable(),
  action: z.string(), source: z.enum(["HTTP", "KAFKA"]).nullable(),
  performed_by: id.nullable(), performed_by_name: z.string().nullable(),
  performed_at: z.string(), endpoint: z.string().nullable(), event_name: z.string().nullable(),
  input_payload: z.string().nullable(), previous_state: z.string().nullable(), new_state: z.string().nullable(),
});
export const auditListSchema = createEnvelopeSchema(z.union([createPaginatedSchema(auditRowSchema), z.null()]));
export const auditDetailSchema = createEnvelopeSchema(auditRowSchema.nullable());
export const auditExportSchema = createEnvelopeSchema(z.object({ filename: z.string(), content: z.string(), totalItems: z.number() }).nullable());
export const auditQuerySchema = z.object({
  page: z.number().int().positive().max(100000).default(1), pageSize: z.number().int().positive().max(100).default(25),
  source: z.enum(["HTTP", "KAFKA"]).optional(), module: z.string().trim().max(80).optional(), action: z.string().trim().max(80).optional(),
  userId: id.optional(), from: z.iso.date().optional(), to: z.iso.date().optional(), search: z.string().trim().max(120).optional(),
}).refine(query => !query.from || !query.to || query.from <= query.to, "End date must follow start date");
export type AuditQuery = z.input<typeof auditQuerySchema>;
