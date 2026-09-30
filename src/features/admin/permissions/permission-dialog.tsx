"use client";
import { fieldClass } from "@/components/ui/form-styles";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ActionDialog } from "@/components/ui/action-dialog";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { createPermissionAction } from "../actions";

/** Adds a permission code to the catalogue. It grants nothing until assigned to a role. */
export function PermissionDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { busy, error, run, clearError } = useActionSubmit(onSaved);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(
      createPermissionAction({
        code: String(form.get("code") ?? ""),
        module: String(form.get("module") ?? ""),
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
      }),
      "Permission created. Add it to a role to enable access."
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
      title="New permission"
      description="Create a code, then grant it to a role. The System Administrator receives it automatically."
      error={error}
    >
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          Code
          <input
            name="code"
            required
            pattern="[A-Z][A-Z0-9_]+"
            maxLength={60}
            placeholder="MODULE_ACTION"
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          Module
          <input
            name="module"
            required
            pattern="[A-Z][A-Z0-9_]+"
            maxLength={40}
            placeholder="ADMIN"
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          Name
          <input name="name" required maxLength={160} className={fieldClass} />
        </label>
        <label className="block text-sm">
          Description
          <textarea name="description" maxLength={500} className={fieldClass} />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Create permission"}
        </Button>
      </form>
    </ActionDialog>
  );
}
