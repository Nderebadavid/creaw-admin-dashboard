import type { DataColumn } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, initials } from "@/lib/format";
import type { ParticipantView } from "../api";

/** Registry columns from the design: participant, county, pillars, stage, registered, status. */
export function participantColumns(
  pillarName: (id: number) => string
): DataColumn<ParticipantView>[] {
  return [
    {
      id: "participant",
      header: "Participant",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-creaw-orange-soft text-[13px] font-bold text-primary"
          >
            {initials(row.name)}
          </span>
          <div>
            <span className="whitespace-nowrap font-semibold">{row.name}</span>
            <p className="text-[12.5px] text-creaw-faint">
              {row.idNumber ? `ID ${row.idNumber}` : "No ID recorded"}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "county",
      header: "County",
      cell: (row) => (
        <div>
          {row.county}
          <p className="text-[12.5px] text-creaw-faint">{row.ward}</p>
        </div>
      ),
    },
    {
      id: "pillars",
      header: "Pillars",
      cell: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.pillarIds.map((id) => (
            <span
              key={id}
              className="rounded-[7px] bg-creaw-orange-soft px-2.5 py-0.5 text-xs font-semibold text-primary"
            >
              {pillarName(id)}
            </span>
          ))}
        </div>
      ),
    },
    {
      id: "stage",
      header: "Current stage",
      cell: (row) => (
        <div>
          {row.currentStage}
          <p className="text-[12.5px] text-creaw-faint">
            {row.enrollments.length} enrollment{row.enrollments.length === 1 ? "" : "s"}
          </p>
        </div>
      ),
    },
    { id: "registered", header: "Registered", cell: (row) => formatDate(row.registered) },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge tone={row.status === "ACTIVE" ? "success" : "neutral"}>
          {row.status}
        </StatusBadge>
      ),
    },
  ];
}
