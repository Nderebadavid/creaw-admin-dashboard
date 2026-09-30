"use client";
import { fieldClass } from "@/components/ui/form-styles";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ActionDialog } from "@/components/ui/action-dialog";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { createRoleAction, updateRoleAction } from "../actions";
import type { RoleView } from "../api";

/** Creates a role, or edits `role`'s name and description when one is given. */
export function RoleDialog({
  open,
  role,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The role being edited; omit to create a new one. */
  role?: RoleView;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { busy, error, run, clearError } = useActionSubmit(onSaved);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    const description = String(form.get("description") ?? "");
    void run(
      role
        ? updateRoleAction({ id: role.id, name, description })
        : createRoleAction({ code: String(form.get("code") ?? ""), name, description }),
      role ? "Role updated." : "Role created."
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
      title={role ? "Edit role" : "New role"}
      description="Roles group permissions and can be assigned to staff within a pillar."
      error={error}
    >
      <form onSubmit={submit} className="space-y-3">
        {!role && (
          <label className="block text-sm">
            Code
            <input
              name="code"
              required
              pattern="[A-Z][A-Z0-9_]+"
              maxLength={40}
              placeholder="ROLE_CODE"
              className={fieldClass}
            />
          </label>
        )}
        <label className="block text-sm">
          Name
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={role?.name ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          Description
          <textarea
            name="description"
            maxLength={500}
            defaultValue={role?.description ?? ""}
            className={fieldClass}
          />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save role"}
        </Button>
      </form>
    </ActionDialog>
  );
}
