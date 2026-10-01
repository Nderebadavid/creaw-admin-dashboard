import type { SortState } from "@/components/data-table/sorting";

/** What a server-paged register asks of the API: one page, already filtered and sorted. */
export interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  /** The table's sort; the column id is mapped to an API field by `listParams`. */
  sort?: SortState;
  /** Exact-match filters on returned fields; empty values are dropped. */
  filters?: Record<string, string | number | boolean | null | undefined>;
  /** Child collections to embed, e.g. "attendees:count". */
  include?: string;
}

/** The result a Server Action hands to `usePagedList`. */
export interface ListResult<T> {
  success: boolean;
  message: string;
  data: {
    items: T[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  } | null;
}

/**
 * Query parameters for the API's list conventions: `page`, `pageSize`, `search`,
 * `sort=field:asc|desc` and exact-match filters. `sortKeys` maps a table column id to
 * the API field it sorts by; an unmapped column id is sent as is.
 */
export function listParams(
  query: ListQuery,
  sortKeys: Record<string, string> = {},
  defaults: { sort?: string } = {}
): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 25,
  };
  if (query.search?.trim()) params.search = query.search.trim();
  // A column may sort by several fields ("a,b"); the direction applies to each.
  if (query.sort)
    params.sort = (sortKeys[query.sort.by] ?? query.sort.by)
      .split(",")
      .map((key) => `${key}:${query.sort!.order}`)
      .join(",");
  else if (defaults.sort) params.sort = defaults.sort;
  if (query.include) params.include = query.include;
  for (const [key, value] of Object.entries(query.filters ?? {}))
    if (value !== undefined && value !== null && value !== "") params[key] = String(value);
  return params;
}

/** A page size the API accepts (1–100). */
export const clampPageSize = (value: number | undefined, fallback = 25) =>
  Number.isInteger(value) && value! >= 1 && value! <= 100 ? value! : fallback;

/**
 * A sort from the browser, kept only when it names one of the table's sortable
 * columns; anything else means "default order". Server Action input is untrusted.
 */
export function sortedColumn(input: unknown, columns: readonly string[]): SortState | undefined {
  if (input === null || typeof input !== "object") return undefined;
  const { by, order } = input as Partial<SortState>;
  if (typeof by !== "string" || !columns.includes(by)) return undefined;
  return order === "asc" || order === "desc" ? { by, order } : undefined;
}

/**
 * A list query from the browser, made safe: a valid page and page size, a bounded
 * search, a sort on a known column, and only the exact-match filters the register offers.
 */
export function cleanListQuery(
  input: ListQuery | undefined,
  allowed: { sort: readonly string[]; filters?: readonly string[]; pageSize?: number }
): ListQuery {
  const filters = Object.fromEntries(
    Object.entries(input?.filters ?? {}).filter(
      ([key, value]) =>
        allowed.filters?.includes(key) && ["string", "number", "boolean"].includes(typeof value)
    )
  );
  // A page or size that is present but out of range is a malformed request, not a default.
  if (input?.page !== undefined && !(Number.isInteger(input.page) && input.page >= 1))
    throw new Error("Invalid pagination");
  if (input?.pageSize !== undefined && clampPageSize(input.pageSize, 0) === 0)
    throw new Error("Invalid pagination");
  return {
    page: input?.page ?? 1,
    pageSize: input?.pageSize ?? allowed.pageSize ?? 25,
    search: typeof input?.search === "string" ? input.search.slice(0, 120) : undefined,
    sort: sortedColumn(input?.sort, allowed.sort),
    filters: Object.keys(filters).length ? filters : undefined,
  };
}
