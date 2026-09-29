"use client";
import { useState, type FormEvent } from "react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { registerParticipantAction, updateParticipantAction } from "../actions";
import type { ParticipantCatalog, ParticipantView } from "../api";

const field = "mt-1 w-full rounded-lg border border-creaw-line-strong bg-white p-2";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await registerParticipantAction({
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
    });
    setBusy(false);
    if (response.success) onDone("Participant registered. Attach the signed consent form next.");
    else setError(response.message);
  }

  return (
    <ActionDialog
      open={open}
      busy={busy}
      onClose={() => {
        setError("");
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
          <input name="firstName" required maxLength={80} className={field} />
        </label>
        <label className="text-sm">
          Last name
          <input name="lastName" required maxLength={80} className={field} />
        </label>
        <label className="text-sm">
          Gender
          <select name="gender" className={field}>
            <option value="">Not recorded</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </label>
        <label className="text-sm">
          Date of birth
          <input name="dateOfBirth" type="date" className={field} />
        </label>
        <label className="text-sm">
          Phone number
          <input name="phoneNumber" type="tel" maxLength={30} className={field} />
        </label>
        <label className="text-sm">
          National ID number
          <input name="idNumber" maxLength={40} className={field} />
        </label>
        <label className="text-sm">
          Ward
          <select name="wardId" className={field}>
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
          <select name="pillarId" required className={field}>
            {pillars.map((pillar) => (
              <option key={pillar.id} value={pillar.id}>
                {pillar.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          Intake notes
          <textarea name="remarks" rows={3} className={field} />
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!participant) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await updateParticipantAction({
      id: participant.id,
      remarks: String(form.get("remarks") ?? ""),
      consentGiven: form.get("consentGiven") === "on",
    });
    setBusy(false);
    if (response.success) onDone("Participant updated.");
    else setError(response.message);
  }

  return (
    <ActionDialog
      open={participant !== null}
      busy={busy}
      onClose={() => {
        setError("");
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
            className={field}
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
