import type { MouseEvent, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableState } from "./table-state";

export interface DataColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
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
  /** Draws its own card border; pass false inside a TableCard. */
  framed?: boolean;
}

/** Clicks on a row's own controls (menus, links, reveal buttons) must not also open it. */
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
  framed = true,
}: DataTableProps<T>) {
  return (
    <div className={cn("overflow-hidden bg-white", framed && "rounded-2xl border")}>
      {loading || error || !rows.length ? (
        <TableState loading={loading} error={error} filtered={filtered} onRetry={onRetry} />
      ) : (
        <div className="overflow-x-auto" role="region" aria-label={`${label} table`} tabIndex={0}>
          <table aria-label={label} className="w-full min-w-[640px] text-left text-[14.5px]">
            <thead className="border-b border-creaw-divider bg-creaw-surface text-[13px] font-semibold text-creaw-faint">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.id}
                    scope="col"
                    className={`whitespace-nowrap px-3.5 py-3 first:pl-5 ${column.className ?? ""}`}
                  >
                    {column.header}
                  </th>
                ))}
                {rowActions && (
                  <th scope="col" className="px-3.5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
                {onRowOpen && (
                  <th scope="col" className="w-10">
                    <span className="sr-only">Open</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={getRowId(row)}
                  onClick={onRowOpen ? (event) => fromControl(event) || onRowOpen(row) : undefined}
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
                  {onRowOpen && (
                    <td className="py-3 pr-3.5 text-right">
                      <button
                        type="button"
                        aria-label={rowOpenLabel(row)}
                        onClick={() => onRowOpen(row)}
                        className="rounded-md p-0.5 text-[#A39A92] hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <ChevronRight size={20} aria-hidden="true" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
