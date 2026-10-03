"use client";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { fieldClass } from "@/components/ui/form-styles";
import type { FormEvent } from "react";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { updateParticipantAction } from "../actions";
import type { ParticipantCatalog, ParticipantView } from "../api";

/** Wards labelled with their county, since ward names repeat across counties. */
const wardOptions = (catalog: ParticipantCatalog) =>
  catalog.wards.map((ward) => {
    const county = catalog.counties.find((row) => row.id === ward.countyId)?.name;
    return { value: ward.id, label: county ? `${ward.name} · ${county}` : ward.name };
  });

const genders = [
  ["female", "Female"],
  ["male", "Male"],
  ["prefer_not_to_say", "Prefer not to say"],
] as const;

/**
 * Edits a participant. Anyone with edit access changes names, phone, remarks and consent;
 * record managers also correct the identity details recorded at registration.
 */
export function EditParticipantDialog({
  participant,
  catalog,
  canEdit,
  canCorrectIdentity,
  onClose,
  onDone,
}: {
  /** The participant being edited; the dialog is open while this is set. */
  participant: ParticipantView | null;
  catalog: ParticipantCatalog;
  /** Holds PARTICIPANT_EDIT in one of the participant's pillars. */
  canEdit: boolean;
  /** Holds PARTICIPANT_RECORD_MANAGE in one of the participant's pillars. */
  canCorrectIdentity: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { busy, error, run, clearError } = useActionSubmit(onDone);
  const canEditBasics = canEdit || canCorrectIdentity;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!participant) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    void run(
      updateParticipantAction({
        id: participant.id,
        firstName: text("firstName"),
        lastName: text("lastName"),
        phoneNumber: text("phoneNumber") || null,
        remarks: text("remarks"),
        consentGiven: form.get("consentGiven") === "on",
        ...(canCorrectIdentity
          ? {
              middleName: text("middleName") || null,
              idNumber: text("idNumber") || null,
              dateOfBirth: text("dateOfBirth") || null,
              gender: text("gender") || null,
              wardId: Number(form.get("wardId")) || null,
              disability: form.get("disability") === "on",
              refugee: form.get("refugee") === "on",
            }
          : {}),
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
      className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
    >
      {participant && canEditBasics && (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            First name
            <input
              name="firstName"
              required
              maxLength={80}
              defaultValue={participant.firstName}
              className={fieldClass}
            />
          </label>
          <label className="text-sm">
            Last name
            <input
              name="lastName"
              required
              maxLength={80}
              defaultValue={participant.lastName}
              className={fieldClass}
            />
          </label>
          <label className="text-sm">
            Phone number
            <input
              name="phoneNumber"
              type="tel"
              maxLength={30}
              defaultValue={participant.phoneNumber ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" name="consentGiven" defaultChecked={participant.consentGiven} />
            Consent recorded
          </label>
          <label className="text-sm sm:col-span-2">
            Remarks
            <textarea
              name="remarks"
              defaultValue={participant.remarks ?? ""}
              rows={3}
              className={fieldClass}
            />
          </label>
          {canCorrectIdentity ? (
            <fieldset className="grid gap-3 border-t border-creaw-line pt-3 sm:col-span-2 sm:grid-cols-2">
              <legend className="text-sm font-semibold">Identity details</legend>
              <label className="text-sm">
                Middle name
                <input
                  name="middleName"
                  maxLength={80}
                  defaultValue={participant.middleName ?? ""}
                  className={fieldClass}
                />
              </label>
              <label className="text-sm">
                National ID number
                <input
                  name="idNumber"
                  maxLength={40}
                  defaultValue={participant.idNumber ?? ""}
                  className={fieldClass}
                />
              </label>
              <label className="text-sm">
                Date of birth
                <input
                  name="dateOfBirth"
                  type="date"
                  defaultValue={participant.dateOfBirth?.slice(0, 10) ?? ""}
                  className={fieldClass}
                />
              </label>
              <label className="text-sm">
                Gender
                <select
                  name="gender"
                  defaultValue={participant.gender ?? ""}
                  className={fieldClass}
                >
                  <option value="">Not recorded</option>
                  {genders.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                Ward
                <SearchableSelect
                  name="wardId"
                  emptyLabel="Not recorded"
                  options={wardOptions(catalog)}
                  defaultValue={participant.wardId}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="disability" defaultChecked={participant.disability} />
                Person living with a disability
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="refugee" defaultChecked={participant.refugee} />
                Refugee
              </label>
            </fieldset>
          ) : (
            <p className="text-[13px] text-creaw-faint sm:col-span-2">
              ID number, date of birth, gender, ward, disability and refugee status can only be
              corrected by a role with “Correct participant identity details”.
            </p>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              Save changes
            </Button>
          </div>
        </form>
      )}
    </ActionDialog>
  );
}
