import type { DataColumn } from "@/components/data-table/data-table";
import { withSortValues } from "@/components/data-table/sorting";
import { updatedColumn } from "@/components/data-table/record-columns";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { PillarChip, pillarLook } from "@/components/portal/pillars";
import { formatDate, initials, titleCase } from "@/lib/format";
import type { ReferralView } from "../api";
import { referralSortValues } from "../sort-values";

const tone = (status: string): StatusTone =>
  status === "NEW" ? "warning" : status === "ACCEPTED" ? "success" : "neutral";

/** Queue columns from the design: participant, route, reason, referrer, date, status. */
export const referralColumns: DataColumn<ReferralView>[] = withSortValues(referralSortValues, [
  {
    id: "participant",
    header: "Participant",
    cell: (row) => {
      // The avatar takes the receiving pillar's colours, as in the design.
      const to = pillarLook(row.toPillarId);
      const from = pillarLook(row.fromPillarId);
      return (
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-[#E7EEF8] text-[13px] font-bold text-[#2F5E9A]"
            style={to && { backgroundColor: to.tint, color: to.color }}
          >
            {initials(row.participant)}
          </span>
          <div>
            <span className="whitespace-nowrap font-semibold">{row.participant}</span>
            <p className="text-[12.5px] text-creaw-faint">
              {from?.name ?? row.fromPillar} →{" "}
              {row.external ? `${row.destinationName} (external)` : (to?.name ?? row.toPillar)}
            </p>
          </div>
        </div>
      );
    },
  },
  {
    id: "route",
    header: "From → to",
    cell: (row) => (
      <div className="flex flex-col gap-0.5">
        <div className="flex flex-wrap gap-[5px]">
          <PillarChip id={row.fromPillarId} fallback={row.fromPillar} />
          {!row.external && <PillarChip id={row.toPillarId} fallback={row.toPillar} />}
        </div>
        {row.external && (
          <span className="text-[12.5px] text-creaw-faint">
            → <span>{row.destinationName}</span>
          </span>
        )}
      </div>
    ),
  },
  {
    id: "reason",
    header: "Reason",
    cell: (row) => (
      <span className="line-clamp-2 max-w-xs font-medium text-creaw-ink-soft">{row.reason}</span>
    ),
  },
  {
    id: "referredBy",
    header: "Referred by",
    cell: (row) => (
      <span className="font-medium text-creaw-ink-soft">
        {row.referredBy ?? <span className="text-creaw-faint">Not recorded</span>}
      </span>
    ),
  },
  {
    id: "date",
    header: "Date",
    cell: (row) => (
      <div className="whitespace-nowrap font-medium text-creaw-ink-soft">
        {formatDate(row.date)}
        <p className="text-[12.5px] font-normal text-creaw-faint">{row.ageDays} days ago</p>
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    cell: (row) => <StatusBadge tone={tone(row.status)}>{titleCase(row.status)}</StatusBadge>,
  },
  updatedColumn((row) => row.updated),
]);
