"use client";
import { fieldClass } from "@/components/ui/form-styles";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    const description = String(form.get("description") ?? "");
    const response = role
      ? await updateRoleAction({ id: role.id, name, description })
      : await createRoleAction({ code: String(form.get("code") ?? ""), name, description });
    setBusy(false);
    if (response.success) onSaved(role ? "Role updated." : "Role created.");
    else setError(response.message);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) {
          setError("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogTitle>{role ? "Edit role" : "New role"}</DialogTitle>
        <DialogDescription>
          Roles group permissions and can be assigned to staff within a pillar.
        </DialogDescription>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
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
      </DialogContent>
    </Dialog>
  );
}
