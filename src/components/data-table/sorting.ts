// Sorting shared by the tables in the browser and by the server when it sorts
// an API-paged list. No React or server-only imports, so both sides can use it.

export type SortOrder = "asc" | "desc";

/** The column a table is sorted by (a `DataColumn` id) and the direction. */
export interface SortState {
  by: string;
  order: SortOrder;
}

export type SortValue = string | number | boolean | null | undefined;

/** How to read each sortable column's value from a row, keyed by column id. */
export type SortValues<T> = Record<string, (row: T) => SortValue>;

// `numeric` orders "Ward 2" before "Ward 10"; `base` ignores case and accents.
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

const isBlank = (value: SortValue) => value === null || value === undefined || value === "";

function compare(a: SortValue, b: SortValue): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a), String(b));
}

/**
 * A sorted copy of `rows`, or `rows` itself when there is nothing to sort by.
 * Blank values stay at the end in both directions.
 */
export function sortRows<T>(
  rows: readonly T[],
  sort: SortState | undefined,
  valueOf: ((row: T) => SortValue) | undefined
): readonly T[] {
  if (!sort || !valueOf) return rows;
  const direction = sort.order === "desc" ? -1 : 1;
  return rows
    .map((row) => ({ row, value: valueOf(row) }))
    .sort((a, b) => {
      const blankA = isBlank(a.value);
      const blankB = isBlank(b.value);
      if (blankA || blankB) return Number(blankA) - Number(blankB);
      return compare(a.value, b.value) * direction;
    })
    .map((entry) => entry.row);
}

/** What a click on a column header does: ascending, then descending, then unsorted. */
export function nextSort(current: SortState | undefined, by: string): SortState | undefined {
  if (current?.by !== by) return { by, order: "asc" };
  return current.order === "asc" ? { by, order: "desc" } : undefined;
}

/** Validates a sort that came from the browser; anything unknown means "unsorted". */
export function parseSort<T>(input: unknown, values: SortValues<T>): SortState | undefined {
  if (input === null || typeof input !== "object") return undefined;
  const { by, order } = input as Partial<SortState>;
  if (typeof by !== "string" || !Object.hasOwn(values, by)) return undefined;
  return order === "asc" || order === "desc" ? { by, order } : undefined;
}

/** Adds `sortValue` to each column that has an entry in `values`. */
export function withSortValues<T, C extends { id: string }>(
  values: SortValues<T>,
  columns: readonly C[]
): (C & { sortValue?: (row: T) => SortValue })[] {
  return columns.map((column) =>
    Object.hasOwn(values, column.id) ? { ...column, sortValue: values[column.id] } : column
  );
}

/** An ISO date or timestamp as a number, so dates sort by time; blank or invalid dates sort last. */
export function dateSortValue(value: string | null | undefined): number | null {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(time) ? null : time;
}

const formattedNumber = /^(?:[A-Z]{3} )?\d[\d,]*(?:\.\d+)?$/;

/**
 * For columns that only hold display text: a formatted amount or count
 * ("KES 1,200,000", "64") sorts by its value, anything else as text.
 */
export function textSortValue(value: string | null | undefined): SortValue {
  return value && formattedNumber.test(value) ? Number(value.replace(/[^\d.]/g, "")) : value;
}
