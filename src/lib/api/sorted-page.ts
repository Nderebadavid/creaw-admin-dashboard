import { parseSort, sortRows, type SortValues } from "@/components/data-table/sorting";
import type { PaginatedData } from "@/types/api";
import { collectPages } from "./pagination";

type Paging = { page?: number; pageSize?: number };

const isCount = (value: number, max: number) =>
  Number.isSafeInteger(value) && value >= 1 && value <= max;

/**
 * One page of a list sorted by a displayed column.
 *
 * The API can only sort by raw database columns, while most table columns are
 * derived (joined names, stages, masked values). So when a sort is requested
 * this reads every row matching the other filters, sorts them by the column's
 * visible value and cuts the page here. Without a sort the query goes straight
 * to `list`, which pages on the API as before.
 */
export async function sortedPage<T, Q extends Paging>(
  list: (query: Q) => Promise<PaginatedData<T>>,
  query: Q & { sort?: unknown },
  values: SortValues<T>
): Promise<PaginatedData<T>> {
  const { sort: requested, ...filters } = query;
  const sort = parseSort(requested, values);
  if (!sort) return list(filters as unknown as Q);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  if (!isCount(page, Number.MAX_SAFE_INTEGER) || !isCount(pageSize, 100))
    throw new Error("Invalid pagination");
  // Facets count over every matching row, so the first page's hold for the sorted page too.
  let facets: PaginatedData<T>["facets"];
  const rows = await collectPages(async (collectPage, collectSize) => {
    const result = await list({
      ...filters,
      page: collectPage,
      pageSize: collectSize,
    } as unknown as Q);
    facets ??= result.facets;
    return result;
  });
  const sorted = sortRows(rows, sort, values[sort.by]);
  return {
    ...(facets ? { facets } : {}),
    items: sorted.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalItems: sorted.length,
    totalPages: Math.ceil(sorted.length / pageSize),
  };
}
