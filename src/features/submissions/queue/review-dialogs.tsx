"use client";
import { Check, Flag } from "lucide-react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import type { SubmissionRow } from "../api";

export type Decision = "approve" | "flag";

/** Full review: approve into the linked record, or flag it for follow-up. */
export function ReviewDialog({
  submission,
  busy,
  onClose,
  onDecide,
}: {
  submission: SubmissionRow | null;
  busy: boolean;
  onClose: () => void;
  onDecide: (decision: Decision) => void;
}) {
  return (
    <ActionDialog
      open={submission !== null}
      busy={busy}
      onClose={onClose}
      title={submission?.title}
      description={
        submission &&
        `${submission.pillar} · ${submission.type} · Captured via ${submission.source}`
      }
      className="sm:max-w-lg"
    >
      <div className="space-y-4 text-sm">
        <p>Review the mobile update before merging it into the linked programme record.</p>
        {submission?.flag && <p className="rounded-lg bg-[#fff1d8] p-3">Flag: {submission.flag}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => onDecide("flag")}>
            <Flag size={16} />
            Flag for follow-up
          </Button>
          <Button disabled={busy} onClick={() => onDecide("approve")}>
            <Check size={16} />
            Approve submission
          </Button>
        </div>
      </div>
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
          <Check size={16} />
          Approve
        </Button>
      </div>
    </ActionDialog>
  );
}
