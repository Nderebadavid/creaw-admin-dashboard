import type { DataColumn } from "@/components/data-table/data-table";
import { withSortValues } from "@/components/data-table/sorting";
import { PillarChip } from "@/components/portal/pillars";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";
import type { ReportView } from "../api";
import { ownerOf, reportSortValues } from "../sort-values";
import { reportStatus } from "../status";

/** Columns from the design: report, donor/programme, pillar, due, owner, status. */
export const reportColumns: DataColumn<ReportView>[] = withSortValues(reportSortValues, [
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
      <div className="font-medium text-creaw-ink-soft">
        {row.project}
        <p className="text-[12.5px] font-normal text-creaw-faint">
          {row.type === "grant" ? "Grant compliance" : "Narrative report"}
        </p>
      </div>
    ),
  },
  {
    id: "pillar",
    header: "Pillar",
    cell: (row) => <PillarChip id={row.pillarId} fallback={row.pillar} />,
  },
  {
    id: "due",
    header: "Due",
    cell: (row) => (
      <span
        className={`whitespace-nowrap font-medium ${row.status === "overdue" ? "text-creaw-danger" : "text-creaw-ink-soft"}`}
      >
        {formatDate(row.dueDate)}
      </span>
    ),
  },
  {
    id: "owner",
    header: "Owner",
    cell: (row) => <span className="font-medium text-creaw-ink-soft">{ownerOf(row)}</span>,
  },
  {
    id: "status",
    header: "Status",
    cell: (row) => {
      const status = reportStatus(row);
      return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
    },
  },
]);
