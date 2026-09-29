import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createEnvelopeSchema, createPaginatedSchema } from "./contracts";

describe("API response contracts", () => {
  it("parses a complete typed envelope", () => {
    const schema = createEnvelopeSchema(z.object({ id: z.number() }));

    expect(
      schema.parse({
        resultCode: 200,
        success: true,
        message: "OK",
        data: { id: 1 },
      }).data.id
    ).toBe(1);
  });

  it("rejects an incomplete envelope", () => {
    const schema = createEnvelopeSchema(z.object({ id: z.number() }));

    expect(() => schema.parse({ success: true, data: { id: 1 } })).toThrow();
  });

  it("parses pagination metadata and typed items", () => {
    const schema = createPaginatedSchema(z.object({ id: z.number() }));
    const result = schema.parse({
      items: [{ id: 1 }],
      page: 1,
      pageSize: 25,
      totalItems: 142,
      totalPages: 6,
    });

    expect(result).toEqual({
      items: [{ id: 1 }],
      page: 1,
      pageSize: 25,
      totalItems: 142,
      totalPages: 6,
    });
  });

  it("rejects missing pagination metadata", () => {
    const schema = createPaginatedSchema(z.string());

    expect(() =>
      schema.parse({ items: [], page: 1, pageSize: 25, totalItems: 142 })
    ).toThrow();
  });
});
