"use client";
import { useState, type FormEvent } from "react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { FileDropField } from "@/components/ui/file-drop-field";
import { fieldClass } from "@/components/ui/form-styles";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { createPillarDomainAction } from "@/features/pillars/actions";
import { attachCaseFileAction, setCourtStatusAction, updateLegalCaseAction } from "../actions";
import { courtStatuses, type LegalCaseView, type VawgWorkspace } from "../model";
import { courtStatusLabel } from "./status";

/** Document types a legal case file holds; stored as document.document_type. */
export const caseFileTypes = [
  ["p3_form", "P3 form"],
  ["prc_form", "PRC form"],
  ["police_abstract", "Police abstract (OB)"],
  ["case_intake_form", "Case intake form"],
  ["court_summons", "Court summons"],
  ["judgment", "Judgment"],
  ["supporting_document", "Supporting document"],
] as const;
export const caseFileCode = (label: string) =>
  caseFileTypes.find(([, name]) => name === label)?.[0] ?? "supporting_document";

/** Edit the court details without placing a masked OB number into the write payload. */
export function EditCaseDialog({
  legalCase,
  caseTypes,
  onClose,
  onDone,
}: {
  legalCase: LegalCaseView | null;
  caseTypes: VawgWorkspace["caseTypes"];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  const close = () => {
    submit.clearError();
    onClose();
  };
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!legalCase) return;
    const form = new FormData(event.currentTarget);
    void submit.run(
      updateLegalCaseAction({
        caseId: legalCase.id,
        caseTypeId: Number(form.get("caseTypeId")),
        court: String(form.get("court") ?? ""),
        courtFileNumber: String(form.get("courtFileNumber") ?? ""),
        obNumber: String(form.get("obNumber") ?? ""),
        assignedOfficer: String(form.get("assignedOfficer") ?? ""),
        counsellor: String(form.get("counsellor") ?? ""),
        nextCourtDate: String(form.get("nextCourtDate") ?? ""),
      }),
      `${legalCase.number} updated`
    );
  }
  return (
    <ActionDialog
      open={legalCase !== null}
      busy={submit.busy}
      onClose={close}
      title="Edit legal case"
      description={legalCase ? `${legalCase.number} · ${legalCase.survivor}` : undefined}
      error={submit.error}
      className="sm:max-w-[640px]"
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={send}>
        <label className="text-sm sm:col-span-2">
          Case type
          <select
            name="caseTypeId"
            required
            defaultValue={caseTypes.find((type) => type.name === legalCase?.caseType)?.id}
            className={fieldClass}
          >
            {caseTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Court
          <input name="court" defaultValue={legalCase?.court ?? ""} className={fieldClass} />
        </label>
        <label className="text-sm">
          Court file number
          <input
            name="courtFileNumber"
            defaultValue={legalCase?.courtFileNumber ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="text-sm">
          OB number
          <input name="obNumber" aria-label="OB number" defaultValue="" className={fieldClass} />
          <span className="mt-1 block text-xs text-muted-foreground">
            Leave blank to keep the current OB number
          </span>
        </label>
        <label className="text-sm">
          Assigned officer
          <input
            name="assignedOfficer"
            defaultValue={legalCase?.assignedOfficer ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="text-sm">
          Counsellor
          <input
            name="counsellor"
            defaultValue={legalCase?.counsellor ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="text-sm">
          Next court date
          <input
            name="nextCourtDate"
            type="date"
            defaultValue={legalCase?.nextCourtDate ?? ""}
            className={fieldClass}
          />
        </label>
        <div className="sm:col-span-2">
          <Button type="button" variant="outline" disabled={submit.busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={submit.busy}>
            Save changes
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}

/** The design's "Status" action: move a case to another court status, noting why. */
export function CourtStatusDialog({
  legalCase,
  onClose,
  onDone,
}: {
  legalCase: LegalCaseView | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  const close = () => {
    submit.clearError();
    onClose();
  };
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!legalCase) return;
    const courtStatus = String(new FormData(event.currentTarget).get("courtStatus"));
    void submit.run(
      setCourtStatusAction({ caseId: legalCase.id, courtStatus }),
      `${legalCase.number} is now ${courtStatusLabel(courtStatus).toLowerCase()}`
    );
  }
  return (
    <ActionDialog
      open={legalCase !== null}
      busy={submit.busy}
      onClose={close}
      title="Change status"
      description={legalCase ? `${legalCase.number} · ${legalCase.survivor}` : undefined}
      error={submit.error}
    >
      <form className="space-y-4" onSubmit={send}>
        <label className="block text-sm">
          New status
          <select
            name="courtStatus"
            defaultValue={legalCase?.courtStatus ?? courtStatuses[0]}
            className={fieldClass}
          >
            {courtStatuses.map((status) => (
              <option key={status} value={status}>
                {courtStatusLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <div>
          <Button type="button" variant="outline" disabled={submit.busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={submit.busy}>
            Update status
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}

/** The design's "Attach": add a file to the case, e.g. a missing P3 form. */
export function AttachCaseFileDialog({
  legalCase,
  documentType,
  onClose,
  onDone,
}: {
  legalCase: LegalCaseView | null;
  /** Preselected type, e.g. the missing form's label. */
  documentType?: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  const [ready, setReady] = useState(false);
  const close = () => {
    submit.clearError();
    onClose();
  };
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!legalCase) return;
    const form = new FormData(event.currentTarget);
    const type = String(form.get("documentType"));
    void submit.run(
      attachCaseFileAction({
        caseId: legalCase.id,
        documentType: type,
        fileUrl: String(form.get("fileUrl") ?? ""),
      }),
      `${caseFileTypes.find(([code]) => code === type)?.[1] ?? "Document"} attached`
    );
  }
  return (
    <ActionDialog
      open={legalCase !== null}
      busy={submit.busy}
      onClose={close}
      title="Attach document"
      description={legalCase ? `${legalCase.number} · ${legalCase.survivor}` : undefined}
      error={submit.error}
      className="sm:max-w-[560px]"
    >
      <form className="space-y-4" onSubmit={send}>
        <label className="block text-sm">
          Document type
          <select
            name="documentType"
            defaultValue={documentType ? caseFileCode(documentType) : "supporting_document"}
            className={fieldClass}
          >
            {caseFileTypes.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <FileDropField
          name="fileUrl"
          target={legalCase ? `${legalCase.number} — ${legalCase.caseType}` : undefined}
          onChange={setReady}
        />
        <div>
          <Button type="button" variant="outline" disabled={submit.busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={submit.busy || !ready}>
            Upload &amp; attach
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}

/** The design's "Open legal case": pick the survivor and case type rather than typing ids. */
export function OpenCaseDialog({
  open,
  workspace,
  onClose,
  onDone,
}: {
  open: boolean;
  workspace: Pick<VawgWorkspace, "caseTypes" | "survivors">;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  const close = () => {
    submit.clearError();
    onClose();
  };
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submit.run(
      createPillarDomainAction("vawg", {
        enrollmentId: Number(form.get("enrollmentId")),
        caseTypeId: Number(form.get("caseTypeId")),
        openedDate: String(form.get("openedDate")),
      }),
      "Legal case opened"
    );
  }
  return (
    <ActionDialog
      open={open}
      busy={submit.busy}
      onClose={close}
      title="Open legal case"
      description="Violence Against Women & Girls"
      error={submit.error}
      className="sm:max-w-[640px]"
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={send}>
        <label className="text-sm sm:col-span-2">
          Survivor (participant)
          <select name="enrollmentId" required defaultValue="" className={fieldClass}>
            <option value="" disabled>
              Choose a survivor enrolled in VAWG
            </option>
            {workspace.survivors.map((survivor) => (
              <option key={survivor.enrollmentId} value={survivor.enrollmentId}>
                {survivor.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Case type
          <select name="caseTypeId" required className={fieldClass}>
            {workspace.caseTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Opened
          <input
            name="openedDate"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={fieldClass}
          />
        </label>
        <div>
          <Button type="button" variant="outline" disabled={submit.busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={submit.busy}>
            Open legal case
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}
