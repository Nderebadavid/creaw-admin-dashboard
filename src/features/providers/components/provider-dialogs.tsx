"use client";
import type { FormEvent, ReactNode } from "react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/form-styles";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { createProviderAction, setProviderActiveAction, updateProviderAction } from "../actions";
import {
  providerTypeLabel,
  providerTypes,
  type ProviderDirectory,
  type ProviderView,
} from "../model";

const KEEP_HINT = "Leave blank to keep the current value";

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="text-sm">
        {label}
        {children}
      </label>
      {hint && <p className="mt-1 text-[12.5px] text-creaw-faint">{hint}</p>}
    </div>
  );
}

/**
 * Add a provider, or edit one. Contacts reach the browser masked, so in edit
 * mode Phone and Email start empty and a blank value keeps what is stored.
 */
export function ProviderFormDialog({
  open,
  institutions,
  provider,
  onClose,
  onDone,
}: {
  open: boolean;
  institutions: ProviderDirectory["institutions"];
  provider: ProviderView | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  // Keep the provider's own institution selectable even when the lookup no longer offers it.
  const keptInstitution =
    provider?.institutionId != null &&
    !institutions.some((item) => item.id === provider.institutionId)
      ? {
          id: provider.institutionId,
          name:
            provider.institution === "Independent" ? "Unknown institution" : provider.institution,
        }
      : null;
  const close = () => {
    submit.clearError();
    onClose();
  };
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const read = (name: string) => String(form.get(name) ?? "");
    const institution = read("institutionId");
    const firstName = read("firstName").trim();
    const lastName = read("lastName").trim();
    const input = {
      id: provider?.id,
      firstName,
      middleName: read("middleName"),
      lastName,
      type: read("type"),
      service: read("service"),
      institutionId: institution === "" ? null : Number(institution),
      phone: read("phone"),
      email: read("email"),
      notes: read("notes"),
    };
    const name = [firstName, read("middleName").trim(), lastName].filter(Boolean).join(" ");
    void submit.run(
      provider ? updateProviderAction(input) : createProviderAction(input),
      provider ? `${name} updated` : `${name} added`
    );
  }
  return (
    <ActionDialog
      open={open}
      busy={submit.busy}
      onClose={close}
      title={provider ? "Edit provider" : "Add provider"}
      description={provider ? provider.name : "Someone outside CREAW who works with participants"}
      error={submit.error}
      className="sm:max-w-[640px]"
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={send}>
        <Field label="First name">
          <input
            name="firstName"
            required
            maxLength={80}
            defaultValue={provider?.firstName ?? ""}
            className={fieldClass}
          />
        </Field>
        <Field label="Middle name">
          <input
            name="middleName"
            maxLength={80}
            defaultValue={provider?.middleName ?? ""}
            className={fieldClass}
          />
        </Field>
        <Field label="Last name">
          <input
            name="lastName"
            required
            maxLength={80}
            defaultValue={provider?.lastName ?? ""}
            className={fieldClass}
          />
        </Field>
        <Field label="Type">
          <select
            name="type"
            required
            defaultValue={provider?.type ?? "counsellor"}
            className={fieldClass}
          >
            {providerTypes.map((type) => (
              <option key={type} value={type}>
                {providerTypeLabel(type)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Service description" className="sm:col-span-2">
          <input
            name="service"
            maxLength={255}
            defaultValue={provider?.service ?? ""}
            className={fieldClass}
          />
        </Field>
        <Field label="Affiliated institution" className="sm:col-span-2">
          <select
            name="institutionId"
            defaultValue={provider?.institutionId == null ? "" : String(provider.institutionId)}
            className={fieldClass}
          >
            <option value="">None</option>
            {keptInstitution && <option value={keptInstitution.id}>{keptInstitution.name}</option>}
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Phone" hint={provider ? KEEP_HINT : undefined}>
          <input name="phone" type="tel" maxLength={30} defaultValue="" className={fieldClass} />
        </Field>
        <Field label="Email" hint={provider ? KEEP_HINT : undefined}>
          <input name="email" type="email" maxLength={160} defaultValue="" className={fieldClass} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea
            name="notes"
            rows={3}
            maxLength={2000}
            defaultValue={provider?.notes ?? ""}
            className={fieldClass}
          />
        </Field>
        <div className="sm:col-span-2">
          <Button type="button" variant="outline" disabled={submit.busy} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={submit.busy}>
            {provider ? "Save changes" : "Add provider"}
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}

/** Confirm taking a provider out of the pickers. */
export function DeactivateProviderDialog({
  provider,
  onClose,
  onDone,
}: {
  provider: ProviderView | null;
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
      open={provider !== null}
      busy={submit.busy}
      onClose={close}
      title="Deactivate provider"
      description={provider?.name}
      error={submit.error}
    >
      {provider && (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit.run(
              setProviderActiveAction({ id: provider.id, active: false }),
              `${provider.name} deactivated`
            );
          }}
        >
          <p className="text-sm">
            {`${provider.name} will no longer appear in pickers. Records already linked to them keep their name.`}
          </p>
          <div>
            <Button type="button" variant="outline" disabled={submit.busy} onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={submit.busy}>
              Deactivate
            </Button>
          </div>
        </form>
      )}
    </ActionDialog>
  );
}
