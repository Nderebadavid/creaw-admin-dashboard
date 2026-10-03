import { Fragment, type MouseEvent, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ariaSort, SortHeader } from "./sort-header";
import type { SortState, SortValue } from "./sorting";
import { TableState } from "./table-state";

export interface DataColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** The value this column sorts by; with `onSortChange` it makes the header sortable. */
  sortValue?: (row: T) => SortValue;
  className?: string;
}
export interface DataTableProps<T> {
  columns: readonly DataColumn<T>[];
  rows: readonly T[];
  getRowId: (row: T) => string | number;
  label: string;
  loading?: boolean;
  error?: string;
  filtered?: boolean;
  onRetry?: () => void;
  rowActions?: (row: T) => ReactNode;
  /** Makes each row open its record; a chevron button keeps this keyboard-reachable. */
  onRowOpen?: (row: T) => void;
  /** Accessible name for a row's open button, e.g. "Open Faith Wanjiku". */
  rowOpenLabel?: (row: T) => string;
  /**
   * Draws the chevron open button (default). Pass false when the row's actions menu
   * already reaches what opening does; the row stays clickable.
   */
  openButton?: boolean;
  /** Draws its own card border; pass false inside a TableCard. */
  framed?: boolean;
  /** Detail shown in a full-width row under a record, e.g. an opened audit entry. */
  renderExpanded?: (row: T) => ReactNode;
  /** The active sort. The table only shows it; the caller sorts `rows`. */
  sort?: SortState;
  onSortChange?: (sort: SortState | undefined) => void;
}

/** Clicks on a row's own controls (menus, links, buttons) must not also open it. */
const fromControl = (event: MouseEvent) =>
  (event.target as HTMLElement).closest("button, a, input, select, textarea, [role='menuitem']");

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  label,
  loading,
  error,
  filtered,
  onRetry,
  rowActions,
  onRowOpen,
  rowOpenLabel = () => "Open record",
  openButton = true,
  framed = true,
  renderExpanded,
  sort,
  onSortChange,
}: DataTableProps<T>) {
  const chevron = Boolean(onRowOpen && openButton);
  const span = columns.length + (rowActions ? 1 : 0) + (chevron ? 1 : 0);
  return (
    <div className={cn("overflow-hidden bg-white", framed && "rounded-2xl border")}>
      {loading || error || !rows.length ? (
        <TableState loading={loading} error={error} filtered={filtered} onRetry={onRetry} />
      ) : (
        <div className="overflow-x-auto" role="region" aria-label={`${label} table`} tabIndex={0}>
          <table aria-label={label} className="w-full min-w-[640px] text-left text-[14.5px]">
            <thead className="border-b border-creaw-divider bg-creaw-surface text-[13px] font-semibold text-creaw-faint">
              <tr>
                {columns.map((column) => {
                  const sortable = Boolean(column.sortValue && onSortChange);
                  return (
                    <th
                      key={column.id}
                      scope="col"
                      aria-sort={sortable ? ariaSort(sort, column.id) : undefined}
                      className={`whitespace-nowrap px-3.5 py-3 first:pl-5 ${column.className ?? ""}`}
                    >
                      {sortable ? (
                        <SortHeader id={column.id} sort={sort} onSortChange={onSortChange!}>
                          {column.header}
                        </SortHeader>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
                {rowActions && (
                  <th scope="col" className="px-3.5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
                {chevron && (
                  <th scope="col" className="w-10">
                    <span className="sr-only">Open</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const expanded = renderExpanded?.(row);
                return (
                  <Fragment key={getRowId(row)}>
                    <tr
                      onClick={
                        onRowOpen ? (event) => fromControl(event) || onRowOpen(row) : undefined
                      }
                      className={cn(
                        "border-b border-creaw-divider last:border-b-0 hover:bg-creaw-surface",
                        onRowOpen && "cursor-pointer"
                      )}
                    >
                      {columns.map((column) => (
                        <td
                          key={column.id}
                          className={`px-3.5 py-3 align-middle first:pl-5 ${column.className ?? ""}`}
                        >
                          {column.cell(row)}
                        </td>
                      ))}
                      {rowActions && <td className="px-3 py-2 text-right">{rowActions(row)}</td>}
                      {chevron && (
                        <td className="py-3 pr-3.5 text-right">
                          <button
                            type="button"
                            aria-label={rowOpenLabel(row)}
                            onClick={() => onRowOpen?.(row)}
                            className="rounded-md p-0.5 text-[#A39A92] hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            <ChevronRight size={20} aria-hidden="true" />
                          </button>
                        </td>
                      )}
                    </tr>
                    {expanded && (
                      <tr className="border-b border-creaw-divider bg-creaw-surface">
                        <td colSpan={span} className="px-5 py-4">
                          {expanded}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
