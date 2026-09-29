import type { ReactNode } from "react";
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
}
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
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      {loading || error || !rows.length ? (
        <TableState loading={loading} error={error} filtered={filtered} onRetry={onRetry} />
      ) : (
        <div className="overflow-x-auto" role="region" aria-label={`${label} table`} tabIndex={0}>
          <table aria-label={label} className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b bg-[#fcfaf7] text-xs uppercase tracking-wide text-[#786e65]">
              <tr>
                {columns.map((column) => (
                  <th key={column.id} scope="col" className={`px-5 py-4 ${column.className ?? ""}`}>
                    {column.header}
                  </th>
                ))}
                {rowActions && (
                  <th scope="col" className="px-5 py-4">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={getRowId(row)} className="hover:bg-accent/50">
                  {columns.map((column) => (
                    <td key={column.id} className={`px-5 py-4 ${column.className ?? ""}`}>
                      {column.cell(row)}
                    </td>
                  ))}
                  {rowActions && <td className="px-3 py-2 text-right">{rowActions(row)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
