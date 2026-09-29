import type { DataColumn } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";
import type { ReportView } from "../api";

const statusTone = (status: string) =>
  status === "submitted" ? "success" : status === "overdue" ? "danger" : "warning";

const ownerOf = (row: ReportView) =>
  row.ownerName ?? (row.ownerId ? `Staff #${row.ownerId}` : "Unassigned");

/** Columns from the design: report, donor/programme, pillar, due, owner, status. */
export const reportColumns: DataColumn<ReportView>[] = [
  {
    id: "report",
    header: "Report",
    cell: (row) => (
      <div>
        <span className="font-semibold">{row.title}</span>
        <p className="text-[12.5px] text-creaw-faint">Owner · {ownerOf(row)}</p>
      </div>
    ),
  },
  {
    id: "programme",
    header: "Donor / programme",
    cell: (row) => (
      <div>
        {row.project}
        <p className="text-[12.5px] text-creaw-faint">
          {row.type === "grant" ? "Grant compliance" : "Narrative report"}
        </p>
      </div>
    ),
  },
  {
    id: "pillar",
    header: "Pillar",
    cell: (row) => (
      <span className="rounded-[7px] bg-creaw-orange-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
        {row.pillar}
      </span>
    ),
  },
  {
    id: "due",
    header: "Due",
    cell: (row) => (
      <span
        className={`whitespace-nowrap ${row.status === "overdue" ? "font-semibold text-creaw-danger" : ""}`}
      >
        {formatDate(row.dueDate)}
      </span>
    ),
  },
  { id: "owner", header: "Owner", cell: ownerOf },
  {
    id: "status",
    header: "Status",
    cell: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge>,
  },
];
