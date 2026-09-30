"use client";
import type { FormEvent } from "react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/form-styles";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { moveOrganisationStageAction } from "../actions";
import type { OrganisationStage, OrganisationView } from "../model";

/** Confirms moving an organisation to a pipeline stage, with an optional note for the record. */
export function StageDialog({
  organisation,
  stage,
  onClose,
  onDone,
}: {
  organisation: OrganisationView | null;
  stage: OrganisationStage | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  function close() {
    submit.clearError();
    onClose();
  }
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organisation?.enrollmentId || !stage) return;
    void submit.run(
      moveOrganisationStageAction({
        enrollmentId: organisation.enrollmentId,
        stageId: stage.id,
        notes: String(new FormData(event.currentTarget).get("notes") ?? "").trim() || undefined,
      }),
      `${organisation.name} moved to ${stage.name}.`
    );
  }
  return (
    <ActionDialog
      open={organisation !== null && stage !== null}
      busy={submit.busy}
      onClose={close}
      title={`Move to ${stage?.name ?? "stage"}?`}
      description={organisation?.name}
      error={submit.error}
    >
      <form className="space-y-4" onSubmit={send}>
        <p className="text-[14.5px] leading-relaxed text-creaw-ink-soft">
          The organisation is recorded as having reached this stage today. The change is kept in its
          pipeline history and the audit log.
        </p>
        <label className="block text-sm">
          Note for the record
          <textarea name="notes" rows={3} maxLength={1000} className={fieldClass} />
        </label>
        <div>
          <Button type="button" variant="outline" disabled={submit.busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={submit.busy}>
            Move to {stage?.name}
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}
