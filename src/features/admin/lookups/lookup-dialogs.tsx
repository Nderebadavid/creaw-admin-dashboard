"use client";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { LookupView } from "../api";
import { fieldClass } from "../form-styles";
import type { LookupTable } from "../schemas";
import { lookupConfig, readLookupValues, type Field, type Option } from "./config";

function ErrorBanner({ error }: { error: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg bg-creaw-danger-soft p-3 text-sm text-creaw-danger">
      {error}
    </p>
  );
}

/** Add or edit form built from the table's field configuration. */
export function LookupEntryDialog({
  open,
  table,
  entry,
  parentName,
  counties,
  pillars,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  table: LookupTable;
  /** The row being edited; omit to add a new one. */
  entry: LookupView | null;
  parentName: string | undefined;
  counties: Option[];
  pillars: Option[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  const config = lookupConfig[table];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(readLookupValues(new FormData(event.currentTarget), config.fields));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogTitle>{entry ? "Edit entry" : `Add ${config.singular}`}</DialogTitle>
        <DialogDescription>
          {parentName ? `Under ${parentName}` : config.subtitle}
        </DialogDescription>
        <ErrorBanner error={error} />
        <form onSubmit={submit} className="space-y-3">
          {config.fields.map((field) => (
            <FieldInput
              key={field.key}
              field={field}
              value={entry?.[field.key as keyof LookupView]}
              options={
                field.source === "county" ? counties : field.source === "pillar" ? pillars : []
              }
              // A pillar's code is referenced elsewhere, so it cannot change after creation.
              readOnly={Boolean(entry) && table === "pillar" && field.key === "code"}
            />
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : entry ? "Save" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldInput({
  field,
  value,
  options,
  readOnly,
}: {
  field: Field;
  value: unknown;
  options: Option[];
  readOnly: boolean;
}) {
  if (field.kind === "checkbox")
    return (
      <label className="block text-sm font-medium">
        <span className="flex items-center gap-2">
          <input type="checkbox" name={field.key} defaultChecked={Boolean(value)} />
          {field.label}
        </span>
      </label>
    );
  return (
    <label className="block text-sm font-medium">
      {field.label}
      {field.kind === "textarea" ? (
        <textarea
          className={fieldClass}
          name={field.key}
          // Masked values ("••••") are never sent back as the new text.
          defaultValue={typeof value === "string" && !value.startsWith("••") ? value : ""}
        />
      ) : field.kind === "select" ? (
        <select
          className={fieldClass}
          name={field.key}
          required={field.required}
          defaultValue={value == null ? "" : String(value)}
        >
          <option value="">{field.required ? "Select" : "None"}</option>
          {field.choices
            ? field.choices.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            : options
                .filter((option) => option.id > 0)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
        </select>
      ) : (
        <input
          className={fieldClass}
          name={field.key}
          required={field.required}
          readOnly={readOnly}
          maxLength={field.key === "code" ? 20 : field.key === "institution_type" ? 30 : 160}
          defaultValue={typeof value === "string" ? value : ""}
        />
      )}
    </label>
  );
}

/** Confirms a soft deactivation or a reactivation of one entry. */
export function ToggleActiveDialog({
  entry,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  /** The entry to toggle; the dialog is open while this is set. */
  entry: LookupView | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (entry: LookupView) => void;
}) {
  const reactivating = Boolean(entry?.is_deleted);
  return (
    <Dialog
      open={entry !== null}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogTitle>{reactivating ? "Reactivate entry?" : "Deactivate entry?"}</DialogTitle>
        <DialogDescription>
          {reactivating
            ? `Reactivate “${entry?.name}”? It will be selectable in forms again.`
            : `Deactivate “${entry?.name}”? Existing records keep their reference.`}
        </DialogDescription>
        <ErrorBanner error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !entry}
            variant={reactivating ? "default" : "destructive"}
            onClick={() => entry && onConfirm(entry)}
          >
            {busy ? "Saving…" : reactivating ? "Reactivate" : "Deactivate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
