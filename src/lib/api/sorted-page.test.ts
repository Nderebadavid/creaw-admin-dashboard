import { describe, expect, it, vi } from "vitest";
import { sortedPage } from "./sorted-page";
import type { SortValues } from "@/components/data-table/sorting";

interface Row {
  id: number;
  name: string;
}
const rows: Row[] = Array.from({ length: 230 }, (_, index) => ({
  id: index + 1,
  name: `Row ${230 - index}`,
}));
const values: SortValues<Row> = { id: (row) => row.id, name: (row) => row.name };

/** A stand-in for a feature API's list: pages the rows that match `search`. */
function makeList() {
  return vi.fn(async (query: { page?: number; pageSize?: number; search?: string }) => {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const matching = rows.filter((row) => !query.search || row.name.endsWith(query.search));
    return {
      items: matching.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      totalItems: matching.length,
      totalPages: Math.ceil(matching.length / pageSize),
    };
  });
}

describe("sortedPage", () => {
  it("passes an unsorted query straight through", async () => {
    const list = makeList();
    const result = await sortedPage(list, { page: 2, pageSize: 10 }, values);
    expect(list).toHaveBeenCalledExactlyOnceWith({ page: 2, pageSize: 10 });
    expect(result.items[0].id).toBe(11);
  });

  it("sorts every matching row before cutting the requested page", async () => {
    const list = makeList();
    const result = await sortedPage(
      list,
      { page: 2, pageSize: 10, sort: { by: "name", order: "asc" } },
      values
    );
    expect(list).toHaveBeenCalledTimes(3);
    expect(list).toHaveBeenCalledWith({ page: 1, pageSize: 100 });
    expect(result).toMatchObject({ page: 2, pageSize: 10, totalItems: 230, totalPages: 23 });
    expect(result.items.map((row) => row.name)).toEqual(
      Array.from({ length: 10 }, (_, index) => `Row ${index + 11}`)
    );
  });

  it("keeps the other filters while collecting", async () => {
    const list = makeList();
    const result = await sortedPage(
      list,
      { search: "7", sort: { by: "id", order: "desc" } },
      values
    );
    expect(list).toHaveBeenCalledWith({ search: "7", page: 1, pageSize: 100 });
    expect(result.totalItems).toBe(23);
    expect(result.items).toHaveLength(23);
  });

  it("ignores a sort on an unknown column", async () => {
    const list = makeList();
    await sortedPage(list, { page: 1, sort: { by: "password", order: "asc" } }, values);
    expect(list).toHaveBeenCalledExactlyOnceWith({ page: 1 });
  });

  it.each([
    { page: 0, pageSize: 10 },
    { page: 1, pageSize: 101 },
    { page: 1.5, pageSize: 10 },
  ])("rejects invalid paging %j when sorting", async (paging) => {
    await expect(
      sortedPage(makeList(), { ...paging, sort: { by: "id", order: "asc" } }, values)
    ).rejects.toThrow("Invalid pagination");
  });

  it("keeps the API's facets on a sorted page", async () => {
    const list = makeList();
    const faceted = vi.fn(async (query: { page?: number; pageSize?: number }) => ({
      ...(await list(query)),
      facets: { status: { open: 230 } },
    }));
    const result = await sortedPage(
      faceted,
      { page: 1, pageSize: 10, sort: { by: "name", order: "asc" } },
      values
    );
    expect(result.facets).toEqual({ status: { open: 230 } });
  });
});
