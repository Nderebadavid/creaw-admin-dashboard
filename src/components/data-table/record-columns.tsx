import type { DataColumn } from "./data-table";
import { dateSortValue } from "./sorting";
import { RecordStatusBadge } from "@/components/ui/record-status";
import { formatUpdated } from "@/lib/format";

/** The record's own status (Active, Inactive…), for registers whose Status column is a domain status. */
export function recordStatusColumn<T>(get: (row: T) => string): DataColumn<T> {
  return {
    id: "record",
    header: "Record",
    sortValue: get,
    cell: (row) => <RecordStatusBadge status={get(row)} />,
  };
}

/** When the record last changed, relative for the last week and a date after that. */
export function updatedColumn<T>(get: (row: T) => string | null | undefined): DataColumn<T> {
  return {
    id: "updated",
    header: "Updated",
    sortValue: (row) => dateSortValue(get(row)),
    cell: (row) => {
      const value = get(row);
      return (
        <span className="whitespace-nowrap font-medium text-creaw-ink-soft">
          {value ? formatUpdated(value) : "—"}
        </span>
      );
    },
  };
}
