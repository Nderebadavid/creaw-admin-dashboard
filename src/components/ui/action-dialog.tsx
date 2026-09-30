"use client";
import { FormBanner } from "@/components/ui/form-banner";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";

/**
 * Dialog shell shared by the portal's create/edit/confirm dialogs: a header
 * with the title and description, then a scrolling body with the error line,
 * and no dismissal while a save is in flight. The caller owns the form or
 * buttons inside; a closing row of buttons becomes the footer band (globals.css).
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
      <DialogContent
        className={cn(
          "flex max-h-[calc(100dvh-3rem)] flex-col gap-0 overflow-hidden p-0",
          className
        )}
      >
        <div className="flex flex-col gap-0.5 border-b border-creaw-divider px-6 py-5">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="pr-10">{description}</DialogDescription>
        </div>
        <div data-dialog-body className="flex flex-col gap-4 overflow-y-auto px-6 py-[22px]">
          <FormBanner tone="error">{error}</FormBanner>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
