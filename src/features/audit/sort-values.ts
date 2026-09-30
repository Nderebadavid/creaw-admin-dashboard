import { dateSortValue, type SortValues } from "@/components/data-table/sorting";
import type { AuditRow } from "./api";

export const sourceLabel = (source: string | null) =>
  source === "KAFKA" ? "Kafka (system)" : source === "HTTP" ? "Portal" : "System";

/** What each audit column sorts by: the text the cell shows. */
export const auditSortValues: SortValues<AuditRow> = {
  entity: (row) => `${row.entity_type ?? "system"} ${row.entity_id ?? ""}`,
  action: (row) => row.action,
  source: (row) => sourceLabel(row.source),
  actor: (row) => row.performed_by_name ?? "System (background job)",
  when: (row) => dateSortValue(row.performed_at),
};
