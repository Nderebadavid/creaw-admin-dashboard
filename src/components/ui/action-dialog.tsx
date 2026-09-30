"use client";
import { FormBanner } from "@/components/ui/form-banner";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";

/**
 * Dialog shell shared by the portal's create/edit/confirm dialogs: a title,
 * description and error line, and no dismissal while a save is in flight.
 * The caller owns the form or buttons inside.
 */
export function ActionDialog({
  open,
  busy = false,
  onClose,
  title,
  description,
  error,
  className,
  children,
}: {
  open: boolean;
  /** While true, Escape, the close button and outside clicks are ignored. */
  busy?: boolean;
  onClose: () => void;
  title: ReactNode;
  description: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent className={className}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <FormBanner tone="error">{error}</FormBanner>
        {children}
      </DialogContent>
    </Dialog>
  );
}
