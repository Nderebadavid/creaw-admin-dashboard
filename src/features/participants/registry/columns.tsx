import type { DataColumn } from "@/components/data-table/data-table";
import { withSortValues } from "@/components/data-table/sorting";
import { PillarChip, pillarLook } from "@/components/portal/pillars";
import { updatedColumn } from "@/components/data-table/record-columns";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, initials, titleCase } from "@/lib/format";
import type { ParticipantView } from "../api";
import { participantSortValues } from "../sort-values";

/** Registry columns from the design: participant, county, pillars, stage, registered, status. */
export function participantColumns(
  pillarName: (id: number) => string
): DataColumn<ParticipantView>[] {
  return withSortValues(participantSortValues(pillarName), [
    {
      id: "participant",
      header: "Participant",
      cell: (row) => {
        // The avatar takes the colours of the participant's first pillar.
        const look = pillarLook(row.pillarIds[0]);
        return (
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-creaw-orange-soft text-[13px] font-bold text-primary"
              style={look && { backgroundColor: look.tint, color: look.color }}
            >
              {initials(row.name)}
            </span>
            <div>
              <span className="flex items-center gap-2 whitespace-nowrap font-semibold">
                {row.name}
                {row.disability && (
                  <span title="Person living with a disability">
                    <StatusBadge tone="info">PWD</StatusBadge>
                  </span>
                )}
              </span>
              <p className="whitespace-nowrap text-[12.5px] text-creaw-faint">
                {row.idNumber ? `ID ${row.idNumber}` : "No ID recorded"}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      id: "county",
      header: "County",
      cell: (row) => (
        <div className="font-medium text-creaw-ink-soft">
          {row.county}
          <p className="text-[12.5px] font-normal text-creaw-faint">{row.ward}</p>
        </div>
      ),
    },
    {
      id: "pillars",
      header: "Pillars",
      cell: (row) => (
        <div className="flex flex-wrap gap-[5px]">
          {row.pillarIds.map((id) => (
            <PillarChip key={id} id={id} fallback={pillarName(id)} />
          ))}
        </div>
      ),
    },
    {
      id: "stage",
      header: "Current stage",
      cell: (row) => (
        <div className="font-medium text-creaw-ink-soft">
          {row.currentStage}
          <p className="text-[12.5px] font-normal text-creaw-faint">
            {row.enrollments.length} enrollment{row.enrollments.length === 1 ? "" : "s"}
          </p>
        </div>
      ),
    },
    {
      id: "curriculum",
      header: "Curriculum",
      cell: (row) =>
        row.curriculum ? (
          <div className="font-medium text-creaw-ink-soft">
            {row.curriculum.done}/{row.curriculum.total}
            {row.curriculum.behind && (
              <p className="text-[12.5px] font-normal text-[#9A5A0E]">Behind</p>
            )}
          </div>
        ) : (
          <span className="text-creaw-faint">—</span>
        ),
    },
    {
      id: "registered",
      header: "Registered",
      cell: (row) => (
        <span className="whitespace-nowrap font-medium text-creaw-ink-soft">
          {formatDate(row.registered)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge tone={row.status === "ACTIVE" ? "success" : "neutral"}>
          {titleCase(row.status)}
        </StatusBadge>
      ),
    },
    updatedColumn((row) => row.updated),
  ]);
}
