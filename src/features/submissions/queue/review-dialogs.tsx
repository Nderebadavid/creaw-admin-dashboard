"use client";
import Link from "next/link";
import { BadgeCheck, Check, CloudCheck, ExternalLink, Flag, Smartphone } from "lucide-react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { pillarLook } from "@/components/portal/pillars";
import { formatDate, titleCase } from "@/lib/format";
import type { SubmissionRow } from "../api";
import { submissionTone } from "./submission-card";

export type Decision = "approve" | "flag";

/** Full review: approve into the linked record, or flag it for follow-up. */
export function ReviewDialog({
  submission,
  reviewable = true,
  busy,
  onClose,
  onDecide,
  onViewPhoto,
}: {
  submission: SubmissionRow | null;
  /** False shows the submission without the approve and flag decisions. */
  reviewable?: boolean;
  busy: boolean;
  onClose: () => void;
  onDecide: (decision: Decision) => void;
  /** Opens one of the submission's photos in the document viewer. */
  onViewPhoto?: (photoId: number) => void;
}) {
  const look = pillarLook(submission?.pillarId);
  return (
    <ActionDialog
      open={submission !== null}
      busy={busy}
      onClose={onClose}
      title={submission?.title}
      description={submission && `${look?.name ?? submission.pillar} · ${submission.type}`}
      className="sm:max-w-[880px]"
    >
      {submission && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={submissionTone[submission.status]}>{submission.status}</StatusBadge>
            <span className="flex items-center gap-1 text-[13px] text-creaw-body">
              <Smartphone size={15} aria-hidden="true" />
              MERL {submission.source} app
            </span>
            <span className="flex items-center gap-1 text-[13px] text-creaw-body">
              <CloudCheck size={15} aria-hidden="true" />
              Synced {formatDate(submission.captured)}
            </span>
          </div>
          {submission.flag && (
            <p className="flex items-center gap-2 rounded-[10px] bg-creaw-danger-soft px-3 py-2.5 text-[13.5px] text-creaw-danger">
              <Flag size={17} aria-hidden="true" className="shrink-0" />
              Flag: {submission.flag}
            </p>
          )}
          {submission.photos && submission.photos.length > 0 && (
            <ul
              aria-label="Photos"
              className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(130px,1fr))]"
            >
              {submission.photos.map((photo) => (
                <li key={photo.id}>
                  <button
                    type="button"
                    onClick={() => onViewPhoto?.(photo.id)}
                    aria-label={`Open photo: ${photo.name}`}
                    className="flex aspect-[4/3] w-full items-end rounded-[10px] border border-creaw-line bg-[repeating-linear-gradient(135deg,#EFE7DE_0_8px,#F7F2EC_8px_16px)] p-1.5 hover:border-[#E2C7B6] focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span className="rounded bg-white/90 px-1.5 py-0.5 text-left font-mono text-[10.5px] text-creaw-body">
                      {photo.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <dl className="grid gap-x-4 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
            {(
              [
                ["Pillar", look?.fullName ?? submission.pillar],
                ["Captured", formatDate(submission.captured)],
                ["Location", submission.place ?? "Not recorded"],
                ["Linked record", submission.category ?? "—"],
                ["Form", submission.type],
                ["Channel", titleCase(submission.source)],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="text-[12.5px] text-creaw-faint">{label}</dt>
                <dd className="text-sm font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[13.5px] text-creaw-body">
            {submission.status === "Approved"
              ? "Approved and merged into the linked programme record."
              : "Review the mobile update before merging it into the linked programme record."}
          </p>
        </>
      )}
      {submission?.status === "Approved" || !reviewable ? (
        <div>
          {look && (
            <Link
              href={`/pillars/${look.slug}`}
              className={`${buttonVariants({ variant: "outline" })} mr-auto`}
            >
              <ExternalLink />
              Open linked record
            </Link>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <div>
          <Button
            variant="outline"
            className="border-[#F3CCC6] text-creaw-danger hover:bg-creaw-danger-soft"
            disabled={busy}
            onClick={() => onDecide("flag")}
          >
            <Flag />
            Flag for follow-up
          </Button>
          <Button disabled={busy} onClick={() => onDecide("approve")}>
            <BadgeCheck />
            Approve submission
          </Button>
        </div>
      )}
    </ActionDialog>
  );
}

/** Quick approval from a card, confirmed first because it merges data into the record. */
export function ApproveDialog({
  submission,
  busy,
  onClose,
  onConfirm,
}: {
  submission: SubmissionRow | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ActionDialog
      open={submission !== null}
      busy={busy}
      onClose={onClose}
      title="Approve submission?"
      description={`Approve “${submission?.title}”? The data is merged into the linked record.`}
    >
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={busy} onClick={onConfirm}>
          <Check />
          Approve
        </Button>
      </div>
    </ActionDialog>
  );
}
