import { z } from "zod";

export function createEnvelopeSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    resultCode: z.number(),
    success: z.boolean(),
    message: z.string(),
    data: dataSchema,
  });
}

export function createPaginatedSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    page: z.number().int(),
    pageSize: z.number().int(),
    totalItems: z.number().int(),
    totalPages: z.number().int(),
    facets: z.record(z.string(), z.record(z.string(), z.number())).optional(),
  });
}
