"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "./button";
import { ActionDialog } from "./action-dialog";
export type ExportResult =
  { success: true; filename: string; content: string } | { success: false; error: string };

/**
 * Bind the current filters to auditedExportAction on the server. CSV is produced only after
 * authorization and audit. As in the design, the download is confirmed first.
 */
export function ExportButton({
  exportAction,
  label = "Export CSV",
  disabled = false,
}: {
  exportAction: () => Promise<ExportResult>;
  label?: string;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function download() {
    setPending(true);
    setError("");
    try {
      const result = await exportAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      const url = URL.createObjectURL(
        new Blob([result.content], { type: "text/csv;charset=utf-8" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setConfirming(false);
    } catch {
      setError("Could not export records. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => {
          setError("");
          setConfirming(true);
        }}
      >
        <Download aria-hidden="true" />
        {label}
      </Button>
      <ActionDialog
        open={confirming}
        busy={pending}
        onClose={() => setConfirming(false)}
        title="Download CSV?"
        description="Exports the rows matching the current filters"
        error={error}
      >
        <div className="flex items-start gap-3.5">
          <span className="flex size-[42px] shrink-0 items-center justify-center rounded-xl bg-creaw-orange-soft text-primary">
            <Download size={22} aria-hidden="true" />
          </span>
          <p className="pt-0.5 text-[14.5px] leading-relaxed text-creaw-ink-soft">
            Download the records in this list as a CSV file? Masked fields (ID numbers, phone
            numbers) stay masked, and the export is recorded in the audit log.
          </p>
        </div>
        <div>
          <Button variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={() => void download()}>
            <Download aria-hidden="true" />
            {pending ? "Preparing export…" : "Download CSV"}
          </Button>
        </div>
      </ActionDialog>
    </>
  );
}
