"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/form-styles";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { useLoadedOptions } from "@/components/ui/use-loaded-options";
import {
  enrolTraineeAction,
  loadTraineeOptionsAction,
  recordOutcomeAction,
  setRecommendationAction,
  updateTraineeAction,
} from "../actions";
import {
  earningStatuses,
  pathwayLabels,
  pathways,
  placedStatuses,
  trainingStatuses,
  trainingStatusLabels,
  workStatuses,
  workStatusLabels,
  type TraineeView,
  type TrainingOption,
  type TrainingStatus,
  type WorkStatus,
} from "../model";

const describe = (trainee: TraineeView | null) =>
  trainee ? `${trainee.name} · ${trainee.course ?? "Course not recorded"}` : undefined;
const idOrNull = (value: FormDataEntryValue | null) => (value ? Number(value) : null);

/** The options with the record's current one kept selectable when it is no longer offered. */
function withCurrent(options: TrainingOption[], id: number | null, label: string | null) {
  return id !== null && !options.some((item) => item.id === id)
    ? [{ id, label: label ?? "Current selection" }, ...options]
    : options;
}

/** Enrol a Skilling participant on a training placement, or edit a placement. */
export function TraineeFormDialog({
  open,
  trainee,
  onClose,
  onDone,
}: {
  open: boolean;
  trainee: TraineeView | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  const options = useLoadedOptions(open, loadTraineeOptionsAction);
  const institutions = withCurrent(
    options.data?.institutions ?? [],
    trainee?.institutionId ?? null,
    trainee?.institution ?? null
  );
  const trainers = withCurrent(
    options.data?.trainers ?? [],
    trainee?.trainerId ?? null,
    trainee?.trainer ?? null
  );
  const close = () => {
    submit.clearError();
    onClose();
  };
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      traineeId: trainee?.id,
      enrollmentId: trainee ? undefined : (idOrNull(form.get("enrollmentId")) ?? undefined),
      pathway: String(form.get("pathway") ?? ""),
      course: String(form.get("course") ?? ""),
      institutionId: idOrNull(form.get("institutionId")),
      trainerId: idOrNull(form.get("trainerId")),
      startDate: String(form.get("startDate") ?? ""),
    };
    void submit.run(
      trainee ? updateTraineeAction(input) : enrolTraineeAction(input),
      trainee ? "Placement updated" : "Trainee enrolled"
    );
  }
  return (
    <ActionDialog
      open={open}
      busy={submit.busy}
      onClose={close}
      title={trainee ? "Edit placement" : "Enrol trainee"}
      description={describe(trainee) ?? "Place a Skilling participant on a training pathway"}
      error={submit.error || options.error}
      className="sm:max-w-[640px]"
    >
      <form
        key={options.data ? "loaded" : "loading"}
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={send}
      >
        {!trainee && (
          <label className="text-sm sm:col-span-2">
            Participant
            <select name="enrollmentId" required defaultValue="" className={fieldClass}>
              <option value="" disabled>
                {options.loading
                  ? "Loading participants…"
                  : options.data?.enrollments.length
                    ? "Choose a Skilling participant"
                    : "No Skilling participants available"}
              </option>
              {(options.data?.enrollments ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm">
          Pathway
          <select
            name="pathway"
            required
            defaultValue={trainee?.pathway ?? ""}
            className={fieldClass}
          >
            <option value="" disabled>
              Choose a pathway
            </option>
            {pathways.map((pathway) => (
              <option key={pathway} value={pathway}>
                {pathwayLabels[pathway]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Course
          <input
            name="course"
            maxLength={160}
            defaultValue={trainee?.course ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="text-sm">
          Institution
          <select
            name="institutionId"
            defaultValue={trainee?.institutionId ?? ""}
            className={fieldClass}
          >
            <option value="">None</option>
            {institutions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Trainer
          <select name="trainerId" defaultValue={trainee?.trainerId ?? ""} className={fieldClass}>
            <option value="">Not assigned</option>
            {trainers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Start date
          <input
            name="startDate"
            type="date"
            defaultValue={trainee?.startDate?.slice(0, 10) ?? ""}
            className={fieldClass}
          />
        </label>
        <div className="sm:col-span-2">
          <Button type="button" variant="outline" disabled={submit.busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={submit.busy}>
            {trainee ? "Save changes" : "Enrol trainee"}
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}

/** The page heading's "Enrol trainee" button. */
export function EnrolTraineeButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Enrol trainee
      </Button>
      <TraineeFormDialog
        key={open ? "open" : "closed"}
        open={open}
        trainee={null}
        onClose={() => setOpen(false)}
        onDone={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

/**
 * Record how training ended and what came after. Only the fields that apply to the
 * chosen status show: a date once training ends, a workplace for those placed, and a
 * salary for those earning. The masked salary is never pre-filled.
 */
export function OutcomeDialog({
  trainee,
  onClose,
  onDone,
}: {
  trainee: TraineeView | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  const [status, setStatus] = useState<TrainingStatus>(trainee?.status ?? "ongoing");
  const [workStatus, setWorkStatus] = useState<WorkStatus | "">(trainee?.workStatus ?? "");
  const finished = status !== "ongoing";
  const placed = finished && workStatus !== "" && placedStatuses.includes(workStatus);
  const earning = finished && workStatus !== "" && earningStatuses.includes(workStatus);
  const close = () => {
    submit.clearError();
    onClose();
  };
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trainee) return;
    const form = new FormData(event.currentTarget);
    const salary = String(form.get("salary") ?? "").trim();
    void submit.run(
      recordOutcomeAction({
        traineeId: trainee.id,
        status,
        completionDate: String(form.get("completionDate") ?? ""),
        workStatus: finished && workStatus !== "" ? workStatus : null,
        workstation: String(form.get("workstation") ?? ""),
        salary: earning && salary ? Number(salary) : null,
      }),
      "Outcome recorded"
    );
  }
  return (
    <ActionDialog
      open={trainee !== null}
      busy={submit.busy}
      onClose={close}
      title="Record outcome"
      description={describe(trainee)}
      error={submit.error}
      className="sm:max-w-[560px]"
    >
      {trainee && (
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={send}>
          <label className="text-sm">
            Training status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as TrainingStatus)}
              className={fieldClass}
            >
              {trainingStatuses.map((value) => (
                <option key={value} value={value}>
                  {trainingStatusLabels[value]}
                </option>
              ))}
            </select>
          </label>
          {finished && (
            <label className="text-sm">
              {status === "dropped_out" ? "Drop-out date" : "Completion date"}
              <input
                name="completionDate"
                type="date"
                required
                min={trainee.startDate?.slice(0, 10)}
                defaultValue={trainee.completionDate?.slice(0, 10) ?? ""}
                className={fieldClass}
              />
            </label>
          )}
          {finished && (
            <label className="text-sm sm:col-span-2">
              Work status
              <select
                value={workStatus}
                onChange={(event) => setWorkStatus(event.target.value as WorkStatus | "")}
                className={fieldClass}
              >
                <option value="">Not recorded yet</option>
                {workStatuses.map((value) => (
                  <option key={value} value={value}>
                    {workStatusLabels[value]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {placed && (
            <label className="text-sm">
              Workplace
              <input
                name="workstation"
                maxLength={160}
                defaultValue={trainee.workstation ?? ""}
                className={fieldClass}
              />
            </label>
          )}
          {earning && (
            <label className="text-sm">
              Monthly salary (KES)
              <input
                name="salary"
                type="number"
                min="1"
                step="1"
                placeholder={trainee.salary ? "Leave blank to keep the current value" : ""}
                className={fieldClass}
              />
            </label>
          )}
          <div className="sm:col-span-2">
            <Button type="button" variant="outline" disabled={submit.busy} onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={submit.busy}>
              Save outcome
            </Button>
          </div>
        </form>
      )}
    </ActionDialog>
  );
}

/** Confirm sending a trainee to WEE as a grant referral, or withdrawing a pending one. */
export function RecommendDialog({
  trainee,
  recommend,
  onClose,
  onDone,
}: {
  trainee: TraineeView | null;
  recommend: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  const close = () => {
    submit.clearError();
    onClose();
  };
  return (
    <ActionDialog
      open={trainee !== null}
      busy={submit.busy}
      onClose={close}
      title={recommend ? "Recommend for grant" : "Withdraw recommendation"}
      description={describe(trainee)}
      error={submit.error}
    >
      {trainee && (
        <div className="space-y-4">
          <p className="text-sm">
            {recommend
              ? `This sends ${trainee.name} to WEE as a grant referral. WEE decides whether to accept it and files the application.`
              : `This withdraws ${trainee.name}'s grant referral, which WEE has not decided yet.`}
          </p>
          <div>
            <Button type="button" variant="outline" disabled={submit.busy} onClick={close}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={recommend ? "default" : "destructive"}
              disabled={submit.busy}
              onClick={() =>
                void submit.run(
                  setRecommendationAction({ traineeId: trainee.id, recommend }),
                  recommend ? `${trainee.name} recommended to WEE` : "Recommendation withdrawn"
                )
              }
            >
              {recommend ? "Recommend" : "Withdraw"}
            </Button>
          </div>
        </div>
      )}
    </ActionDialog>
  );
}
