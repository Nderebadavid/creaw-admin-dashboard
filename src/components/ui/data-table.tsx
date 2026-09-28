"use client";

import { useMemo } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { SortingState } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const columnHelper = createColumnHelper<any>();

interface PaginationConfig {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

interface DataTableProps<T> {
  data: T[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  loading?: boolean;
  emptyMessage?: string;
  pagination?: PaginationConfig | null;
  showCheckbox?: boolean;
  selectedRows?: Set<string>;
  onSelectedRowsChange?: (selected: Set<string>) => void;
  getRowId?: (row: T) => string;
  stickyColumn?: string;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
}

const DataTable = <T,>({
  data = [],
  columns = [],
  loading = false,
  emptyMessage = "No data found",
  pagination = null,
  showCheckbox = false,
  selectedRows,
  onSelectedRowsChange,
  getRowId,
  stickyColumn = "actions",
  sorting = [],
  onSortingChange,
}: DataTableProps<T>) => {
  const tableData = useMemo(() => data, [data]);

  const finalColumns = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cols: ColumnDef<T, any>[] = [...columns];

    cols.unshift({
      id: "rowNumber",
      header: () => "#",
      cell: (info) => (
        <span className="text-sm text-foreground">
          {pagination
            ? (pagination.currentPage - 1) * pagination.pageSize +
              info.row.index +
              1
            : info.row.index + 1}
        </span>
      ),
    });

    if (showCheckbox && selectedRows && onSelectedRowsChange && getRowId) {
      cols.unshift({
        id: "select",
        header: () => {
          const allPageIds = data.map((row) => getRowId(row));
          const allSelected =
            allPageIds.length > 0 &&
            allPageIds.every((id) => selectedRows.has(id));
          const someSelected =
            !allSelected && allPageIds.some((id) => selectedRows.has(id));

          return (
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={() => {
                const next = new Set(selectedRows);
                if (allSelected) {
                  allPageIds.forEach((id) => next.delete(id));
                } else {
                  allPageIds.forEach((id) => next.add(id));
                }
                onSelectedRowsChange(next);
              }}
              className="w-4 h-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
            />
          );
        },
        cell: (info) => {
          const rowId = getRowId(info.row.original as T);
          const checked = selectedRows.has(rowId);

          return (
            <input
              type="checkbox"
              checked={checked}
              onChange={() => {
                const next = new Set(selectedRows);
                if (checked) {
                  next.delete(rowId);
                } else {
                  next.add(rowId);
                }
                onSelectedRowsChange(next);
              }}
              className="w-4 h-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
            />
          );
        },
      });
    }

    return cols;
  }, [columns, showCheckbox, selectedRows, onSelectedRowsChange, getRowId, data, pagination]);

  const table = useReactTable({
    data: tableData,
    columns: finalColumns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
  });

  const getPageNumbers = () => {
    if (!pagination) return [];

    const { currentPage, pageSize, totalItems } = pagination;
    const totalPages = Math.ceil(totalItems / pageSize);
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");

      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);

      for (let i = startPage; i <= endPage; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      if (totalPages > 1) pages.push(totalPages);
    }
    return pages;
  };

  const totalPages = pagination
    ? Math.ceil(pagination.totalItems / pagination.pageSize)
    : 0;

  if (loading) {
    return (
      <div className="bg-card rounded-lg overflow-hidden border">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg overflow-hidden border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.columnDef.enableSorting === true;
                  const sortEntry = sorting.find(
                    (s) => s.id === header.column.id
                  );
                  const sortDir = sortEntry?.desc === false
                    ? "asc"
                    : sortEntry?.desc === true
                      ? "desc"
                      : null;

                  const handleSort = () => {
                    if (!canSort || !onSortingChange) return;
                    if (sortDir === null) {
                      onSortingChange([{ id: header.column.id, desc: false }]);
                    } else if (sortDir === "asc") {
                      onSortingChange([{ id: header.column.id, desc: true }]);
                    } else {
                      onSortingChange([]);
                    }
                  };

                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "px-4 py-5 text-left text-sm font-normal text-foreground whitespace-nowrap",
                        header.id === stickyColumn &&
                          "sticky right-0 bg-muted shadow-[-2px_0_4px_rgba(0,0,0,0.05)]",
                        canSort && "cursor-pointer select-none"
                      )}
                      onClick={canSort ? handleSort : undefined}
                    >
                      <span className={canSort ? "inline-flex items-center gap-1" : ""}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        {canSort && (
                          sortDir === "asc" ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : sortDir === "desc" ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
                          )
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={finalColumns.length}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={index % 2 === 0 ? "bg-card" : "bg-muted/40"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-4 py-5 whitespace-nowrap",
                        cell.column.id === stickyColumn &&
                          cn(
                            "sticky right-0 shadow-[-2px_0_4px_rgba(0,0,0,0.05)]",
                            index % 2 === 0 ? "bg-card" : "bg-muted/40"
                          )
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalItems > 0 && (
        <div className="bg-card border-t border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {(pagination.currentPage - 1) * pagination.pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium text-foreground">
                {Math.min(
                  pagination.currentPage * pagination.pageSize,
                  pagination.totalItems
                )}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">
                {pagination.totalItems.toLocaleString()}
              </span>{" "}
              results
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  pagination.onPageChange(pagination.currentPage - 1)
                }
                disabled={pagination.currentPage === 1}
                className={cn(
                  "inline-flex items-center justify-center h-9 px-3 rounded-md border text-sm font-medium transition-colors",
                  pagination.currentPage === 1
                    ? "border-border bg-muted text-muted-foreground cursor-not-allowed"
                    : "border-border bg-card text-foreground hover:bg-muted cursor-pointer"
                )}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Prev
              </button>

              <div className="flex items-center gap-1 mx-2">
                {getPageNumbers().map((page, index) => (
                  <span key={index}>
                    {page === "..." ? (
                      <span className="px-2 text-muted-foreground text-sm">...</span>
                    ) : (
                      <button
                        onClick={() =>
                          pagination.onPageChange(page as number)
                        }
                        className={cn(
                          "inline-flex items-center justify-center min-w-[36px] h-9 px-3 rounded-md text-sm font-medium transition-colors",
                          pagination.currentPage === page
                            ? "bg-primary text-primary-foreground"
                            : "bg-card text-foreground hover:bg-muted cursor-pointer"
                        )}
                      >
                        {(page as number).toLocaleString()}
                      </button>
                    )}
                  </span>
                ))}
              </div>

              <button
                onClick={() =>
                  pagination.onPageChange(pagination.currentPage + 1)
                }
                disabled={
                  pagination.currentPage === totalPages || totalPages === 0
                }
                className={cn(
                  "inline-flex items-center justify-center h-9 px-3 rounded-md border text-sm font-medium transition-colors",
                  pagination.currentPage === totalPages || totalPages === 0
                    ? "border-border bg-muted text-muted-foreground cursor-not-allowed"
                    : "border-border bg-card text-foreground hover:bg-muted cursor-pointer"
                )}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Helper to create column definitions
 */
export const createColumn = <T,>(
  accessor: string,
  header: string,
  cellRenderer?: ((value: unknown, row: T) => React.ReactNode) | null,
  options?: { sortable?: boolean }
) => {
  return columnHelper.accessor(accessor, {
    header: () => header,
    enableSorting: options?.sortable === true,
    cell: (info) => {
      if (cellRenderer) {
        return cellRenderer(info.getValue(), info.row.original as T);
      }
      return <span className="text-sm text-foreground">{info.getValue()}</span>;
    },
  });
};

/**
 * Helper to create display column (no data accessor)
 */
export const createDisplayColumn = <T,>(
  id: string,
  header: string,
  cellRenderer: (row: T) => React.ReactNode
) => {
  return columnHelper.display({
    id,
    header: () => header,
    cell: (info) => cellRenderer(info.row.original as T),
  });
};

/**
 * Helper to create status badge column
 */
export const createStatusColumn = (
  accessor: string,
  header: string,
  statusColors: Record<string, string> = {}
) => {
  const defaultColors: Record<string, string> = {
    Approved: "bg-primary/10 text-primary",
    Pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    Draft: "bg-muted text-muted-foreground",
    Active: "bg-primary/10 text-primary",
    Inactive: "bg-destructive/10 text-destructive",
  };

  const colors = { ...defaultColors, ...statusColors };

  return columnHelper.accessor(accessor, {
    header: () => header,
    cell: (info) => {
      const status = info.getValue() as string;
      const colorClass = colors[status] || "bg-muted text-muted-foreground";
      return (
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-normal ${colorClass}`}
        >
          {status}
        </span>
      );
    },
  });
};

export type { SortingState };
export default DataTable;
