"use client";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { FormEvent } from "react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/form-styles";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { useLoadedOptions } from "@/components/ui/use-loaded-options";
import { loadOrganisationOptionsAction, registerOrganisationAction } from "../actions";
import { legalForms, type OrganisationRegistration } from "../schemas";

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim() || undefined;

/**
 * The field app's "Register organisation": organisation details, where it
 * works, and the signed data-sharing agreement that must precede any record.
 */
export function RegisterOrganisationDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  const options = useLoadedOptions(open, loadOrganisationOptionsAction);
  const wards = options.data?.wards ?? [];
  function close() {
    submit.clearError();
    onClose();
  }
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submit.run(
      registerOrganisationAction({
        name: text(form, "name") ?? "",
        legalForm: String(form.get("legalForm")) as OrganisationRegistration["legalForm"],
        registrationNumber: text(form, "registrationNumber"),
        wardId: Number(form.get("wardId")) || undefined,
        address: text(form, "address"),
        hasBankAccount: form.get("hasBankAccount") === "on",
        entryCategory: text(form, "entryCategory") ?? "",
        dataSharingAgreed: form.get("dataSharingAgreed") === "on",
      }),
      "Organisation registered. Record its first assessment next."
    );
  }
  return (
    <ActionDialog
      open={open}
      busy={submit.busy}
      onClose={close}
      title="Register organisation"
      description="A WRO partner joins at Onboarding and moves through due diligence to a sub-grant."
      error={submit.error || options.error}
      className="sm:max-w-[640px]"
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={send}>
        <label className="text-sm sm:col-span-2">
          Organisation name
          <input
            name="name"
            required
            minLength={2}
            maxLength={200}
            placeholder="e.g. Imara Women Collective"
            className={fieldClass}
          />
        </label>
        <label className="text-sm">
          Registration number
          <input
            name="registrationNumber"
            maxLength={80}
            placeholder="e.g. CBO/2019/04471"
            className={fieldClass}
          />
        </label>
        <label className="text-sm">
          Legal form
          <select name="legalForm" required defaultValue="cbo" className={fieldClass}>
            {Object.entries(legalForms).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Ward of operation
          <SearchableSelect
            name="wardId"
            emptyLabel="Not recorded"
            options={wards.map((ward) => ({ value: ward.id, label: ward.name }))}
          />
        </label>
        <label className="text-sm">
          Programme category
          <input
            name="entryCategory"
            required
            minLength={2}
            maxLength={120}
            defaultValue="Sub-grant applicant"
            className={fieldClass}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          Office address
          <input name="address" maxLength={255} className={fieldClass} />
        </label>
        <label className="flex items-start gap-2.5 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="hasBankAccount"
            className="mt-0.5 size-[18px] accent-primary"
          />
          <span>
            <span className="block font-semibold">Holds a bank account in its own name</span>
            <span className="text-[12.5px] text-creaw-faint">Shown on the profile</span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 rounded-[10px] border border-dashed border-[#F2C98A] bg-[#FFFBF4] p-3 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="dataSharingAgreed"
            required
            className="mt-0.5 size-[18px] accent-primary"
          />
          <span>
            <span className="block font-semibold">Data-sharing agreement signed</span>
            <span className="text-[12.5px] text-creaw-faint">
              Signed by the organisation representative before any data is captured
            </span>
          </span>
        </label>
        <div>
          <Button type="button" variant="outline" disabled={submit.busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={submit.busy}>
            {submit.busy ? "Registering…" : "Register organisation"}
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}
