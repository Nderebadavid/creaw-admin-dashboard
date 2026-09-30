import type { DataColumn } from "@/components/data-table/data-table";
import { withSortValues } from "@/components/data-table/sorting";
import type { AuditRow } from "../api";
import { auditSortValues, sourceLabel } from "../sort-values";

export { sourceLabel };

export const displayDate = (iso: string) =>
  new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });

/** The design colours actions by kind: creates green, edits blue, deletes red, exports amber. */
function actionTone(action: string) {
  if (/CREATE|UPLOAD|LOGIN/.test(action)) return "good";
  if (/DELETE|DEACTIVATE|WITHDRAW/.test(action)) return "crit";
  if (/EXPORT/.test(action)) return "warn";
  if (/VIEW|DOWNLOAD|REVEAL|LOGOUT/.test(action)) return "neutral";
  return "info";
}
const actionTones = {
  good: "bg-[#E3F3EA] text-[#1F7A4D]",
  info: "bg-[#E7EEF8] text-[#2F5E9A]",
  crit: "bg-creaw-danger-soft text-creaw-danger",
  warn: "bg-[#FDEFD9] text-[#9A5A0E]",
  neutral: "bg-[#F4EEE8] text-creaw-body",
};

/** Audit columns from the design: entity, action, source, performed by and when. */
export const auditColumns: DataColumn<AuditRow>[] = withSortValues(auditSortValues, [
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
      <span
        className={`rounded-md px-2 py-[3px] font-mono text-[11.5px] font-bold ${actionTones[actionTone(row.action)]}`}
      >
        {row.action}
      </span>
    ),
  },
  {
    id: "source",
    header: "Source",
    cell: (row) => (
      <span
        className={`rounded-full px-2.5 py-[3px] text-xs font-bold ${row.source === "KAFKA" ? "bg-[#E7EEF8] text-[#2F5E9A]" : "bg-[#F4EEE8] text-creaw-body"}`}
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
]);
