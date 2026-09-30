"use client";
import { fieldClass } from "@/components/ui/form-styles";
import { useState, type FormEvent } from "react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { FileDropField } from "@/components/ui/file-drop-field";
import {
  approveAssessmentAction,
  attachAssessmentDocumentAction,
  recommendAssessmentAction,
  recordAssessmentAction,
} from "../actions";
import { dueDiligenceDocuments, type AssessmentRecord } from "../schemas";

type DueDiligenceDocument = AssessmentRecord["documents"][number];
import type { AssessmentOptions, AssessmentView } from "../api";
import { recommendationLabels } from "./assessment-drawer";

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
            className={fieldClass}
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
  const [ready, setReady] = useState(false);
  function close() {
    submit.clearError();
    onClose();
  }
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!checkId) return;
    void submit.run(
      attachAssessmentDocumentAction({
        checkId,
        fileUrl: String(new FormData(event.currentTarget).get("fileUrl") ?? ""),
      }),
      `${checkName ?? "Document"} attached`
    );
  }
  return (
    <ActionDialog
      open={checkId !== null}
      busy={submit.busy}
      onClose={close}
      title="Attach document"
      description={checkName}
      error={submit.error}
      className="sm:max-w-[560px]"
    >
      <form className="space-y-4" onSubmit={send}>
        <label className="block text-sm">
          Document type
          <select disabled value={checkName} className={fieldClass}>
            <option>{checkName}</option>
          </select>
        </label>
        <FileDropField
          name="fileUrl"
          target={`the due-diligence check “${checkName}”`}
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

/** The two documents the field app asks for with every assessment. */
const defaultDocuments: readonly DueDiligenceDocument[] = [
  "Registration certificate",
  "Audited accounts",
];

/**
 * Records an organisation assessment as the field app does: the instrument,
 * a 1–5 score for each of its domains, the assessor's notes, whether a
 * follow-up visit is needed, and the due-diligence documents to collect.
 */
export function NewAssessmentDialog({
  open,
  options,
  organisationId,
  onClose,
  onDone,
}: {
  open: boolean;
  options: AssessmentOptions;
  /** Preselects the organisation, e.g. when opened from its profile. */
  organisationId?: number;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  const [instrumentId, setInstrumentId] = useState(options.instruments[0]?.id ?? 0);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [unscored, setUnscored] = useState(false);
  const instrument = options.instruments.find((item) => item.id === instrumentId);
  const criteria = instrument?.criteria ?? [];

  function close() {
    submit.clearError();
    setScores({});
    setUnscored(false);
    onClose();
  }
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (criteria.some((criterion) => !scores[criterion.id])) {
      setUnscored(true);
      return;
    }
    const form = new FormData(event.currentTarget);
    void submit.run(
      recordAssessmentAction({
        organisationId: Number(form.get("organisationId")),
        instrumentId,
        scores: criteria.map((criterion) => ({
          criterionId: criterion.id,
          score: scores[criterion.id],
        })),
        notes: String(form.get("notes") ?? "") || undefined,
        followUp: form.get("followUp") === "on",
        documents: form.getAll("documents").map(String) as DueDiligenceDocument[],
      }),
      "Assessment saved. Scores and the document checklist are on the organisation's card."
    );
  }
  return (
    <ActionDialog
      open={open}
      busy={submit.busy}
      onClose={close}
      title="New assessment"
      description="Score each domain from 1 (weak) to 5 (strong), as on the mobile app"
      error={submit.error}
      className="sm:max-w-[640px]"
    >
      <form className="space-y-4" onSubmit={send}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Organisation
            <select
              name="organisationId"
              required
              defaultValue={organisationId ?? ""}
              className={fieldClass}
            >
              <option value="" disabled>
                Choose an organisation
              </option>
              {options.organisations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Assessment instrument
            <select
              name="instrumentId"
              required
              value={instrumentId}
              onChange={(event) => {
                setInstrumentId(Number(event.target.value));
                setScores({});
                setUnscored(false);
              }}
              className={fieldClass}
            >
              {options.instruments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {criteria.length > 0 && (
          <fieldset className="space-y-2.5">
            <legend className="mb-2 text-[13.5px] font-semibold text-creaw-ink-soft">
              Domain scores (1–5)
            </legend>
            {criteria.map((criterion) => (
              <div
                key={criterion.id}
                role="radiogroup"
                aria-label={criterion.label}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-creaw-divider px-3 py-2"
              >
                <span className="text-sm font-medium">{criterion.label}</span>
                <span className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((value) => {
                    const on = scores[criterion.id] === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={`${criterion.label}: ${value}`}
                        onClick={() => setScores({ ...scores, [criterion.id]: value })}
                        className={`size-9 rounded-lg border text-sm font-semibold ${on ? "border-primary bg-primary text-white" : "border-creaw-line-strong bg-white text-creaw-ink-soft hover:bg-accent"}`}
                      >
                        {value}
                      </button>
                    );
                  })}
                </span>
              </div>
            ))}
            {unscored && (
              <p role="alert" className="text-[13px] text-creaw-danger">
                Score every domain before saving.
              </p>
            )}
          </fieldset>
        )}
        <label className="block text-sm">
          Assessor notes
          <textarea
            name="notes"
            rows={3}
            maxLength={2000}
            placeholder="Key strengths and gaps"
            className={fieldClass}
          />
        </label>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="followUp" className="mt-0.5 size-[18px] accent-primary" />
          <span>
            <span className="block font-semibold">Needs follow-up visit</span>
            <span className="text-[12.5px] text-creaw-faint">Adds to next month&apos;s plan</span>
          </span>
        </label>
        <fieldset>
          <legend className="mb-2 text-[13.5px] font-semibold text-creaw-ink-soft">
            Due-diligence documents to collect
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {dueDiligenceDocuments.map((name) => (
              <label key={name} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="documents"
                  value={name}
                  defaultChecked={defaultDocuments.includes(name)}
                  className="size-[18px] accent-primary"
                />
                {name}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <Button type="button" variant="outline" disabled={submit.busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={submit.busy}>
            Save assessment
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}
