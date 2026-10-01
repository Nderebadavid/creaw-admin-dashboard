"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { HeartHandshake } from "lucide-react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/form-styles";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { logCounsellingAction, updateCounsellingAction } from "../actions";
import {
  counsellingTypeLabels,
  counsellingTypes,
  type CounsellingSessionView,
  type CounsellingType,
  type VawgWorkspace,
} from "../model";

type CounsellingWorkspace = Pick<
  VawgWorkspace,
  "survivors" | "counselling" | "counsellors" | "currentUserId"
>;

/** "staff:6" or "provider:1" from the counsellor select. */
function parseCounsellor(value: string) {
  const [kind, id] = value.split(":");
  return { kind: kind as "staff" | "provider", id: Number(id) };
}

/** Today in the browser's own time zone as YYYY-MM-DD (not UTC, which lags EAT overnight). */
function localToday() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Log a counselling session for a survivor, or edit one. The next session number is
 * shown but assigned by the system; masked notes are never pre-filled, so leaving
 * them blank on an edit keeps the notes on file.
 */
export function CounsellingFormDialog({
  open,
  workspace,
  enrollmentId,
  session,
  onClose,
  onDone,
}: {
  open: boolean;
  workspace: CounsellingWorkspace;
  /** The survivor, when the dialog opens from their record or case. */
  enrollmentId?: number;
  session: CounsellingSessionView | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  const [survivor, setSurvivor] = useState(String(session?.enrollmentId ?? enrollmentId ?? ""));
  const { counsellors, currentUserId } = workspace;
  const staff = counsellors.filter((item) => item.kind === "staff");
  const providers = counsellors.filter((item) => item.kind === "provider");
  const ref = session?.counsellorRef ?? null;
  const keptCurrent =
    session && ref && !counsellors.some((item) => item.kind === ref.kind && item.id === ref.id)
      ? { value: `${ref.kind}:${ref.id}`, label: session.counsellor.name }
      : null;
  const meIsCounsellor = staff.some((item) => item.id === currentUserId);
  const defaultCounsellor = ref
    ? `${ref.kind}:${ref.id}`
    : !session && meIsCounsellor
      ? `staff:${currentUserId}`
      : "";
  const sessions =
    workspace.counselling?.find((row) => String(row.enrollmentId) === survivor)?.sessions ?? [];
  const nextNumber = Math.max(0, ...sessions.map((row) => row.number)) + 1;
  const name = workspace.survivors.find((row) => String(row.enrollmentId) === survivor)?.label;
  const close = () => {
    submit.clearError();
    onClose();
  };
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      sessionId: session?.id,
      enrollmentId: session ? undefined : Number(survivor),
      sessionDate: String(form.get("sessionDate") ?? ""),
      sessionType: String(form.get("sessionType") ?? ""),
      counsellor: parseCounsellor(String(form.get("counsellor") ?? "")),
      notes: String(form.get("notes") ?? ""),
    };
    void submit.run(
      session ? updateCounsellingAction(input) : logCounsellingAction(input),
      session ? "Counselling session updated" : "Counselling session logged"
    );
  }
  return (
    <ActionDialog
      open={open}
      busy={submit.busy}
      onClose={close}
      title={session ? `Edit session ${session.number}` : "Log counselling session"}
      description={
        session ? name : "Violence Against Women & Girls · notes are confidential and masked"
      }
      error={submit.error}
      className="sm:max-w-[640px]"
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={send}>
        {!session && (
          <label className="text-sm sm:col-span-2">
            Survivor
            <select
              required
              value={survivor}
              onChange={(event) => setSurvivor(event.target.value)}
              className={fieldClass}
            >
              <option value="" disabled>
                Choose a survivor enrolled in VAWG
              </option>
              {workspace.survivors.map((row) => (
                <option key={row.enrollmentId} value={row.enrollmentId}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {!session && survivor !== "" && (
          <p role="status" className="text-sm text-creaw-faint sm:col-span-2">
            {`This will be session ${nextNumber} for ${name ?? "this survivor"}.`}
          </p>
        )}
        <label className="text-sm">
          Date
          <input
            name="sessionDate"
            type="date"
            required
            max={localToday()}
            defaultValue={session?.date.slice(0, 10) ?? localToday()}
            className={fieldClass}
          />
        </label>
        <label className="text-sm">
          Session type
          <select
            name="sessionType"
            required
            defaultValue={
              session?.type ??
              ((sessions.length === 0 ? "psychological_first_aid" : "follow_up") as CounsellingType)
            }
            className={fieldClass}
          >
            {counsellingTypes.map((type) => (
              <option key={type} value={type}>
                {counsellingTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          Counsellor
          <select
            name="counsellor"
            required
            defaultValue={defaultCounsellor}
            className={fieldClass}
          >
            {defaultCounsellor === "" && (
              <option value="" disabled>
                {counsellors.length || keptCurrent
                  ? "Choose a counsellor"
                  : "The counsellor list could not be loaded"}
              </option>
            )}
            {keptCurrent && <option value={keptCurrent.value}>{keptCurrent.label}</option>}
            {staff.length > 0 && (
              <optgroup label="CREAW counsellors">
                {staff.map((item) => (
                  <option key={item.id} value={`staff:${item.id}`}>
                    {item.name}
                  </option>
                ))}
              </optgroup>
            )}
            {providers.length > 0 && (
              <optgroup label="External counsellors">
                {providers.map((item) => (
                  <option key={item.id} value={`provider:${item.id}`}>
                    {`${item.name} · ${item.detail}`}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          Notes
          <textarea
            name="notes"
            rows={4}
            maxLength={4000}
            placeholder={
              session?.notes
                ? "Leave blank to keep the current notes"
                : "Confidential session notes"
            }
            className={fieldClass}
          />
        </label>
        <div className="sm:col-span-2">
          <Button type="button" variant="outline" disabled={submit.busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={submit.busy}>
            {session ? "Save changes" : "Log session"}
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}

/** The VAWG heading's "Log counselling session" button. */
export function LogCounsellingButton({ workspace }: { workspace: CounsellingWorkspace }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <HeartHandshake />
        Log counselling session
      </Button>
      <CounsellingFormDialog
        key={open ? "open" : "closed"}
        open={open}
        workspace={workspace}
        session={null}
        onClose={() => setOpen(false)}
        onDone={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
