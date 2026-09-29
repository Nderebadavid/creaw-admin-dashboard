"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { createPermissionAction } from "../actions";
import { fieldClass } from "../form-styles";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await createPermissionAction({
      code: String(form.get("code") ?? ""),
      module: String(form.get("module") ?? ""),
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
    });
    setBusy(false);
    if (response.success) onSaved("Permission created. Add it to a role to enable access.");
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
        <DialogTitle>New permission</DialogTitle>
        <DialogDescription>
          Create a code, then grant it to a role. The System Administrator receives it
          automatically.
        </DialogDescription>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
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
      </DialogContent>
    </Dialog>
  );
}
