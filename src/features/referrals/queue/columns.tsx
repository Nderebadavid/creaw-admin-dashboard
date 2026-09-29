import type { DataColumn } from "@/components/data-table/data-table";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";
import type { ReferralView } from "../api";

const tone = (status: string): StatusTone =>
  status === "NEW" ? "warning" : status === "ACCEPTED" ? "success" : "neutral";

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Queue columns from the design: participant, route, reason, referrer, date, status. */
export const referralColumns: DataColumn<ReferralView>[] = [
  {
    id: "participant",
    header: "Participant",
    cell: (row) => (
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-[#E9EEF9] text-[13px] font-bold text-[#36548e]"
        >
          {initials(row.participant)}
        </span>
        <div>
          <span className="whitespace-nowrap font-semibold">{row.participant}</span>
          <p className="text-[12.5px] text-creaw-faint">
            {row.fromPillar} → {row.destinationName}
            {row.external ? " (external)" : ""}
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "route",
    header: "From → to",
    cell: (row) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-[7px] bg-creaw-orange-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
          {row.fromPillar}
        </span>
        <span aria-hidden="true">→</span>
        <span className="rounded-[7px] bg-[#E9EEF9] px-2.5 py-0.5 text-xs font-semibold text-[#36548e]">
          {row.destinationName}
        </span>
      </div>
    ),
  },
  {
    id: "reason",
    header: "Reason",
    cell: (row) => <span className="line-clamp-2 max-w-xs">{row.reason}</span>,
  },
  {
    id: "referredBy",
    header: "Referred by",
    cell: (row) => row.referredBy ?? <span className="text-creaw-faint">Not recorded</span>,
  },
  {
    id: "date",
    header: "Date",
    cell: (row) => (
      <div className="whitespace-nowrap">
        {formatDate(row.date)}
        <p className="text-[12.5px] text-creaw-faint">{row.ageDays} days ago</p>
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    cell: (row) => <StatusBadge tone={tone(row.status)}>{row.status}</StatusBadge>,
  },
];
