import { Camera, Clock, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";
import type { SubmissionRow, SubmissionStatus } from "../api";

const tone: Record<SubmissionStatus, "warning" | "danger" | "success"> = {
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
  const reason = !reviewable
    ? "You do not have review permission"
    : approved
      ? "Already approved"
      : undefined;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-creaw-line bg-white">
      <div className="flex h-36 items-end justify-between bg-[repeating-linear-gradient(135deg,#EFE7DE_0_10px,#F7F2EC_10px_20px)] p-3">
        <span className="rounded bg-white/85 px-2 py-0.5 font-mono text-[11px] text-creaw-faint">
          photo · {row.type.toLowerCase()}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-creaw-ink/75 px-2 py-0.5 text-[11px] font-semibold text-white">
          <Camera size={12} aria-hidden="true" />
          <span className="sr-only">Captured on</span> mobile
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            {row.pillar} · {row.type}
          </span>
          <StatusBadge tone={tone[row.status]}>{row.status}</StatusBadge>
        </div>
        <h3 className="font-heading text-xl font-bold">{row.title}</h3>
        <ul className="space-y-1 text-[13px] text-creaw-faint">
          <li className="flex items-center gap-1.5">
            <Clock size={14} aria-hidden="true" />
            Captured {formatDate(row.captured)}
          </li>
          <li className="flex items-center gap-1.5">
            <Smartphone size={14} aria-hidden="true" />
            Synced via {row.source}
          </li>
        </ul>
        {row.flag && (
          <p className="rounded-lg bg-[#fff1d8] px-3 py-2 text-xs text-[#94570d]">
            Flag: {row.flag}
          </p>
        )}
        <div className="mt-auto flex gap-2 border-t border-creaw-divider pt-3">
          <Button
            variant="outline"
            size="sm"
            disabled={!reviewable || approved}
            title={reason}
            onClick={onReview}
            aria-label={`Review ${row.title}`}
          >
            Review
          </Button>
          {!approved && (
            <Button
              size="sm"
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
