"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cellKey, type PendingChange } from "./use-permission-matrix";

/** Lists staged grants and revocations for confirmation before they are saved. */
export function ReviewDialog({
  open,
  changes,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  changes: PendingChange[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogTitle>Review permission changes</DialogTitle>
        <DialogDescription>
          Changes to active roles immediately alter effective access and are recorded in the audit
          log.
        </DialogDescription>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {changes.map((item) => (
            <li
              key={cellKey(item.role.id, item.permission.id)}
              className="rounded-lg border p-2 text-sm"
            >
              {item.enabled ? "Grant" : "Revoke"} <strong>{item.permission.name}</strong> ·{" "}
              {item.role.name}
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={onConfirm}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
