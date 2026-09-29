"use client";
import { useState, type ReactNode, type FormEvent } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./dialog";
import { Button } from "./button";
export function ModalForm({open,onOpenChange,title,description,children,action,submitLabel="Save"}:{open:boolean;onOpenChange:(open:boolean)=>void;title:string;description:string;children:ReactNode;action:(data:FormData)=>Promise<{success:boolean;error?:string}>;submitLabel?:string}) {
  const [pending,setPending] = useState(false), [error,setError] = useState("");
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const data = new FormData(event.currentTarget);setPending(true);setError("");
    try {const result = await action(data);if (result.success) onOpenChange(false);else setError(result.error ?? "Could not save changes.");}
    catch {setError("Could not save changes. Please try again.");}
    finally {setPending(false);}
  }
  return (
    <Dialog open={open} onOpenChange={next => {if (!pending) {setError("");onOpenChange(next);}}}>
      <DialogContent className="flex max-h-[calc(100dvh-3rem)] flex-col overflow-hidden sm:max-w-lg" showCloseButton={!pending}>
        <div className="shrink-0 space-y-2 pr-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </div>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4">
          <div role="region" aria-label={`${title} fields`} tabIndex={0} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain rounded-sm p-1 focus-visible:outline-2 focus-visible:outline-primary">
            <fieldset disabled={pending} className="space-y-4">{children}</fieldset>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
