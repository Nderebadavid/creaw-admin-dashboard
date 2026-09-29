import { describe, expect, it } from "vitest";
import { collectPages } from "./pagination";

describe("collectPages", () => {
  it("follows pagination metadata beyond the first hundred records", async () => {
    const records = Array.from({ length: 215 }, (_, index) => index + 1);
    const seen: number[] = [];
    const result = await collectPages(async (page, pageSize) => {
      seen.push(page);
      return { items: records.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalItems: records.length, totalPages: Math.ceil(records.length / pageSize) };
    });
    expect(seen).toEqual([1, 2, 3]);
    expect(result).toHaveLength(215);
    expect(result.at(-1)).toBe(215);
  });
});
