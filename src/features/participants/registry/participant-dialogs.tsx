"use client";
import { fieldClass } from "@/components/ui/form-styles";
import type { FormEvent } from "react";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { registerParticipantAction, updateParticipantAction } from "../actions";
import type { ParticipantCatalog, ParticipantView } from "../api";

const optional = (form: FormData, name: string) => String(form.get(name) ?? "") || undefined;

/** Creates one participant record and its first pillar enrollment. */
export function RegisterParticipantDialog({
  open,
  catalog,
  pillars,
  onClose,
  onDone,
}: {
  open: boolean;
  catalog: ParticipantCatalog;
  /** Pillars the user may enrol into. */
  pillars: { id: number; name: string }[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { busy, error, run, clearError } = useActionSubmit(onDone);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(
      registerParticipantAction({
        firstName: String(form.get("firstName") ?? ""),
        lastName: String(form.get("lastName") ?? ""),
        gender: optional(form, "gender"),
        dateOfBirth: optional(form, "dateOfBirth"),
        phoneNumber: optional(form, "phoneNumber"),
        idNumber: optional(form, "idNumber"),
        wardId: Number(form.get("wardId")) || undefined,
        pillarId: Number(form.get("pillarId")),
        remarks: optional(form, "remarks"),
        consentGiven: form.get("consentGiven") === "on",
      }),
      "Participant registered. Attach the signed consent form next."
    );
  }

  return (
    <ActionDialog
      open={open}
      busy={busy}
      onClose={() => {
        clearError();
        onClose();
      }}
      title="Register participant"
      description="One participant record, shared across every pillar they join."
      error={error}
      className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
    >
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <label className="text-sm">
          First name
          <input name="firstName" required maxLength={80} className={fieldClass} />
        </label>
        <label className="text-sm">
          Last name
          <input name="lastName" required maxLength={80} className={fieldClass} />
        </label>
        <label className="text-sm">
          Gender
          <select name="gender" className={fieldClass}>
            <option value="">Not recorded</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </label>
        <label className="text-sm">
          Date of birth
          <input name="dateOfBirth" type="date" className={fieldClass} />
        </label>
        <label className="text-sm">
          Phone number
          <input name="phoneNumber" type="tel" maxLength={30} className={fieldClass} />
        </label>
        <label className="text-sm">
          National ID number
          <input name="idNumber" maxLength={40} className={fieldClass} />
        </label>
        <label className="text-sm">
          Ward
          <select name="wardId" className={fieldClass}>
            <option value="">Not recorded</option>
            {catalog.wards.map((ward) => (
              <option key={ward.id} value={ward.id}>
                {ward.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Enrol into pillar
          <select name="pillarId" required className={fieldClass}>
            {pillars.map((pillar) => (
              <option key={pillar.id} value={pillar.id}>
                {pillar.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          Intake notes
          <textarea name="remarks" rows={3} className={fieldClass} />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="consentGiven" />
          Consent recorded
        </label>
        <div className="sm:col-span-2">
          <Button disabled={busy} type="submit">
            {busy ? "Registering…" : "Register participant"}
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}

/** Edits the fields a pillar officer may change after registration. */
export function EditParticipantDialog({
  participant,
  onClose,
  onDone,
}: {
  /** The participant being edited; the dialog is open while this is set. */
  participant: ParticipantView | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { busy, error, run, clearError } = useActionSubmit(onDone);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!participant) return;
    const form = new FormData(event.currentTarget);
    void run(
      updateParticipantAction({
        id: participant.id,
        remarks: String(form.get("remarks") ?? ""),
        consentGiven: form.get("consentGiven") === "on",
      }),
      "Participant updated."
    );
  }

  return (
    <ActionDialog
      open={participant !== null}
      busy={busy}
      onClose={() => {
        clearError();
        onClose();
      }}
      title="Edit participant"
      description={participant?.name}
      error={error}
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">
          Remarks
          <textarea
            name="remarks"
            defaultValue={participant?.remarks ?? ""}
            rows={4}
            className={fieldClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="consentGiven" defaultChecked={participant?.consentGiven} />
          Consent recorded
        </label>
        <Button type="submit" disabled={busy}>
          Save changes
        </Button>
      </form>
    </ActionDialog>
  );
}
