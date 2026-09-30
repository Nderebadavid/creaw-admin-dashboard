"use client";
import type { FormEvent } from "react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import {
  approveAssessmentAction,
  attachAssessmentDocumentAction,
  recommendAssessmentAction,
} from "../actions";
import type { AssessmentView } from "../api";
import { recommendationLabels } from "./assessment-drawer";

const field = "mt-1 w-full rounded-lg border border-creaw-line-strong bg-white p-2";

/**
 * Records a proposed recommendation, or approves one. Approval needs a
 * separate permission so the assessor and approver are different people.
 */
export function RecommendationDialog({
  assessment,
  approve,
  onClose,
  onDone,
}: {
  assessment: AssessmentView | null;
  approve: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assessment) return;
    const input = {
      id: assessment.id,
      recommendation: String(new FormData(event.currentTarget).get("recommendation") ?? ""),
    };
    void submit.run(
      approve ? approveAssessmentAction(input) : recommendAssessmentAction(input),
      approve ? "Recommendation approved." : "Recommendation recorded for review."
    );
  }
  return (
    <ActionDialog
      open={assessment !== null}
      busy={submit.busy}
      onClose={() => {
        submit.clearError();
        onClose();
      }}
      title={approve ? "Approve recommendation" : "Record recommendation"}
      description={
        assessment &&
        `${assessment.organisation} · capacity score ${assessment.score.toFixed(1)} / 5`
      }
      error={submit.error}
    >
      <form className="space-y-3" onSubmit={send}>
        <label className="block text-sm">
          Recommendation
          <select
            name="recommendation"
            defaultValue={assessment?.proposedRecommendation ?? ""}
            required
            className={field}
          >
            <option value="">Select recommendation</option>
            {Object.entries(recommendationLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={submit.busy}>
          Save
        </Button>
      </form>
    </ActionDialog>
  );
}

/** Attaches a due-diligence document link to one checklist item. */
export function AttachDocumentDialog({
  checkName,
  checkId,
  onClose,
  onDone,
}: {
  checkName: string | undefined;
  /** The checklist item being completed; the dialog is open while this is set. */
  checkId: number | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!checkId) return;
    void submit.run(
      attachAssessmentDocumentAction({
        checkId,
        fileUrl: String(new FormData(event.currentTarget).get("fileUrl") ?? ""),
      }),
      "Document attached to the assessment check."
    );
  }
  return (
    <ActionDialog
      open={checkId !== null}
      busy={submit.busy}
      onClose={() => {
        submit.clearError();
        onClose();
      }}
      title="Attach due diligence document"
      description={checkName}
      error={submit.error}
    >
      <form className="space-y-3" onSubmit={send}>
        <label className="block text-sm">
          Document URL
          <input name="fileUrl" type="url" required placeholder="https://…" className={field} />
        </label>
        <p className="text-xs text-creaw-faint">Mock mode stores document metadata only.</p>
        <Button type="submit" disabled={submit.busy}>
          Attach document
        </Button>
      </form>
    </ActionDialog>
  );
}
