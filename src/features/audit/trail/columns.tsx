import type { DataColumn } from "@/components/data-table/data-table";
import type { AuditRow } from "../api";

export const displayDate = (iso: string) =>
  new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });

export const sourceLabel = (source: string | null) =>
  source === "KAFKA" ? "Kafka (system)" : source === "HTTP" ? "Portal" : "System";

/** Audit columns from the design: entity, action, source, performed by and when. */
export const auditColumns: DataColumn<AuditRow>[] = [
  {
    id: "entity",
    header: "Entity",
    cell: (row) => (
      <span className="font-mono text-[13px] font-semibold">
        {row.entity_type ?? "system"}{" "}
        {row.entity_id ? <span className="text-[#A39A92]">#{row.entity_id}</span> : null}
      </span>
    ),
  },
  {
    id: "action",
    header: "Action",
    cell: (row) => (
      <span className="rounded-md bg-creaw-orange-soft px-2 py-0.5 font-mono text-xs font-semibold text-creaw-orange">
        {row.action}
      </span>
    ),
  },
  {
    id: "source",
    header: "Source",
    cell: (row) => (
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${row.source === "KAFKA" ? "bg-[#E9EEF9] text-[#36548e]" : "bg-creaw-canvas text-creaw-body"}`}
      >
        {sourceLabel(row.source)}
      </span>
    ),
  },
  {
    id: "actor",
    header: "Performed by",
    cell: (row) => (
      <span
        className={`whitespace-nowrap font-semibold ${row.performed_by_name ? "" : "text-creaw-faint"}`}
      >
        {row.performed_by_name ?? "System (background job)"}
      </span>
    ),
  },
  {
    id: "when",
    header: "Performed at",
    cell: (row) => (
      <time
        dateTime={row.performed_at}
        className="whitespace-nowrap font-mono text-[13px] text-creaw-body"
      >
        {displayDate(row.performed_at)}
      </time>
    ),
  },
];
