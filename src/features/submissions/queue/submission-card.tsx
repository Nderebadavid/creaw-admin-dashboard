import { Camera, Clock, MapPin, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { pillarLook } from "@/components/portal/pillars";
import { formatDate } from "@/lib/format";
import type { SubmissionRow, SubmissionStatus } from "../api";

export const submissionTone: Record<SubmissionStatus, "warning" | "danger" | "success"> = {
  "Pending review": "warning",
  Flagged: "danger",
  Approved: "success",
};

/** One mobile submission: a photo placeholder, what was captured, and review actions. */
export function SubmissionCard({
  row,
  reviewable,
  onReview,
  onApprove,
}: {
  row: SubmissionRow;
  /** The user may review submissions in this record's pillar. */
  reviewable: boolean;
  onReview: () => void;
  onApprove: () => void;
}) {
  const approved = row.status === "Approved";
  const reason = reviewable ? undefined : "You do not have review permission";
  const look = pillarLook(row.pillarId);

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-creaw-line bg-white">
      <div className="flex h-[150px] items-end justify-between bg-[repeating-linear-gradient(135deg,#EFE7DE_0_8px,#F7F2EC_8px_16px)] p-2.5">
        <span className="rounded bg-white/85 px-[7px] py-[3px] font-mono text-[11px] text-creaw-faint">
          photo · {row.type.toLowerCase()}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-creaw-ink/60 px-2 py-[3px] text-xs font-semibold text-white">
          <Camera size={14} aria-hidden="true" />
          {row.photos?.length ?? 0}
          <span className="sr-only">photos, captured on {row.source}</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[11.5px] font-bold uppercase tracking-[.06em] text-primary"
            style={{ color: look?.color }}
          >
            {look?.name ?? row.pillar} · {row.type}
          </span>
          <StatusBadge tone={submissionTone[row.status]}>{row.status}</StatusBadge>
        </div>
        <h3 className="text-[15.5px] font-semibold leading-snug">{row.title}</h3>
        <ul className="flex flex-col gap-[3px] text-[13px] text-creaw-body">
          {row.category && (
            <li className="flex items-center gap-1.5">
              <UserRound size={15} aria-hidden="true" className="text-[#A39A92]" />
              {row.category}
            </li>
          )}
          <li className="flex items-center gap-1.5">
            <MapPin size={15} aria-hidden="true" className="text-[#A39A92]" />
            {row.place ?? "Location not recorded"}
          </li>
          <li className="flex items-center gap-1.5">
            <Clock size={15} aria-hidden="true" className="text-[#A39A92]" />
            {formatDate(row.captured)} · via {row.source}
          </li>
        </ul>
        {row.flag && (
          <p className="rounded-lg bg-creaw-danger-soft px-2.5 py-2 text-[13px] text-creaw-danger">
            Flag: {row.flag}
          </p>
        )}
        <div className="mt-auto flex gap-2 pt-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-[38px] flex-1"
            disabled={!reviewable}
            title={reason}
            onClick={onReview}
            aria-label={`Review ${row.title}`}
          >
            Review
          </Button>
          {!approved && (
            <Button
              size="sm"
              className="h-[38px] flex-1"
              disabled={!reviewable}
              title={reason}
              onClick={onApprove}
              aria-label={`Approve ${row.title}`}
            >
              Approve
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
