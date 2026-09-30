"use client";
import type { FormEvent } from "react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/form-styles";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import type { StageView } from "../api";
import {
  addStageAction,
  createPipelineAction,
  moveStageAction,
  removeStageAction,
  renameStageAction,
} from "../pipeline-actions";
import type { PipelinePillar, PipelineRecord, StageModal } from "./types";

type Done = (message: string) => void;

function TextField({
  label,
  name,
  defaultValue,
  autoFocus,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        className={fieldClass}
        name={name}
        required
        maxLength={160}
        defaultValue={defaultValue}
        autoFocus={autoFocus}
      />
    </label>
  );
}

const formTitle = { add: "Add stage", rename: "Rename stage", create: "Create pipeline" };

/** Adds or renames a stage, or creates a pillar's first pipeline with its end stages. */
export function StageFormDialog({
  modal,
  pillar,
  pipeline,
  stages,
  onClose,
  onDone,
}: {
  /** Open for add, rename and create; closed otherwise. */
  modal: StageModal | null;
  pillar: PipelinePillar | undefined;
  pipeline: PipelineRecord | undefined;
  stages: StageView[];
  onClose: () => void;
  onDone: Done;
}) {
  const { busy, error, run, clearError } = useActionSubmit(onDone);
  const kind =
    modal?.kind === "add" || modal?.kind === "rename" || modal?.kind === "create"
      ? modal.kind
      : null;
  const renaming = modal?.kind === "rename" ? modal.stage : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name"));
    if (kind === "create" && pillar)
      void run(
        createPipelineAction({
          pillarId: pillar.id,
          name,
          firstStage: String(form.get("firstStage")),
          lastStage: String(form.get("lastStage")),
        }),
        "Pipeline created."
      );
    if (kind === "add" && pipeline)
      void run(
        addStageAction({ pipelineId: pipeline.id, name, position: Number(form.get("position")) }),
        "Stage added."
      );
    if (renaming) void run(renameStageAction({ stageId: renaming.id, name }), "Stage renamed.");
  }

  return (
    <ActionDialog
      open={kind !== null}
      busy={busy}
      onClose={() => {
        clearError();
        onClose();
      }}
      title={kind ? formTitle[kind] : ""}
      description={pillar?.name ?? "Pipeline configuration"}
      error={error}
      className="max-h-[85dvh] overflow-y-auto sm:max-w-md"
    >
      <form onSubmit={submit} className="space-y-4">
        {kind === "create" && (
          <>
            <TextField
              label="Pipeline name"
              name="name"
              defaultValue={
                pillar?.name === "Leadership"
                  ? "Women in leadership pathway"
                  : `${pillar?.name} pathway`
              }
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="First stage" name="firstStage" defaultValue="Mobilisation" />
              <TextField label="Final stage" name="lastStage" defaultValue="Graduation" />
            </div>
          </>
        )}
        {(kind === "add" || kind === "rename") && (
          <TextField label="Stage name" name="name" defaultValue={renaming?.name ?? ""} autoFocus />
        )}
        {kind === "add" && (
          <label className="block text-sm font-medium">
            Position
            <select className={fieldClass} name="position" defaultValue={stages.length + 1}>
              {stages.map((stage, index) => (
                <option key={stage.id} value={index + 1}>
                  Before {index + 1}. {stage.name}
                </option>
              ))}
              <option value={stages.length + 1}>At the end</option>
            </select>
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : kind === "create" ? "Create pipeline" : "Save"}
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}

/** Confirms moving a stage one step, or soft-removing it from the pipeline. */
export function StageConfirmDialog({
  modal,
  pillarName,
  onClose,
  onDone,
}: {
  /** Open for move and remove; closed otherwise. */
  modal: StageModal | null;
  pillarName: string | undefined;
  onClose: () => void;
  onDone: Done;
}) {
  const { busy, error, run, clearError } = useActionSubmit(onDone);
  const action = modal?.kind === "move" || modal?.kind === "remove" ? modal : null;

  function confirm() {
    if (action?.kind === "move")
      void run(
        moveStageAction({ stageId: action.stage.id, direction: action.direction }),
        "Stage moved."
      );
    if (action?.kind === "remove")
      void run(removeStageAction({ stageId: action.stage.id }), "Stage removed.");
  }

  return (
    <ActionDialog
      open={action !== null}
      busy={busy}
      onClose={() => {
        clearError();
        onClose();
      }}
      title={action?.kind === "move" ? `Move stage ${action.direction}` : "Remove stage"}
      description={
        action?.kind === "move"
          ? `Move “${action.stage.name}” ${action.direction} in the ${pillarName} pipeline?`
          : `Remove “${action?.stage.name}”? Existing records keep their stage history, but active records may need to move to another stage.`
      }
      error={error}
      className="sm:max-w-md"
    >
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant={action?.kind === "remove" ? "destructive" : "default"}
          disabled={busy}
          onClick={confirm}
        >
          {busy ? "Saving…" : action?.kind === "move" ? "Move stage" : "Remove stage"}
        </Button>
      </div>
    </ActionDialog>
  );
}
