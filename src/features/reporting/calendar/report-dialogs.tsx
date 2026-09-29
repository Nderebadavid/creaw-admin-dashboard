"use client";
import type { FormEvent } from "react";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { addDeadlineAction, submitReportAction } from "../actions";
import type { ReportView } from "../api";

const field = "mt-1 w-full rounded-lg border border-creaw-line-strong bg-white p-2";

/**
 * Adds a narrative-report deadline. The programme determines the pillar and
 * owner, so the schema's narrative_report row needs nothing else.
 */
export function AddDeadlineDialog({
  open,
  projects,
  onClose,
  onDone,
}: {
  open: boolean;
  /** Programmes in pillars where the user manages narrative reports. */
  projects: { id: number; name: string }[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submit.run(
      addDeadlineAction({
        projectId: Number(form.get("projectId")),
        title: String(form.get("title") ?? ""),
        periodStart: String(form.get("periodStart") ?? ""),
        periodEnd: String(form.get("periodEnd") ?? ""),
      }),
      "Reporting deadline added."
    );
  }

  return (
    <ActionDialog
      open={open}
      busy={submit.busy}
      onClose={() => {
        submit.clearError();
        onClose();
      }}
      title="Add reporting deadline"
      description="Owners get reminders 14 and 3 days before. The programme sets the pillar and owner."
      error={submit.error}
    >
      <form className="space-y-3" onSubmit={send}>
        <label className="block text-sm">
          Report title
          <input name="title" required maxLength={255} className={field} />
        </label>
        <label className="block text-sm">
          Programme
          <select name="projectId" required className={field}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Period start
            <input name="periodStart" type="date" required className={field} />
          </label>
          <label className="block text-sm">
            Due / period end
            <input name="periodEnd" type="date" required className={field} />
          </label>
        </div>
        <Button type="submit" disabled={submit.busy}>
          Add deadline
        </Button>
      </form>
    </ActionDialog>
  );
}

/** Marks a report submitted, attaching the document link (required for grant reports). */
export function SubmitReportDialog({
  report,
  onClose,
  onDone,
}: {
  report: ReportView | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!report) return;
    const form = new FormData(event.currentTarget);
    void submit.run(
      submitReportAction({
        type: report.type,
        id: report.id,
        date: String(form.get("date") ?? ""),
        fileUrl: String(form.get("fileUrl") ?? "") || undefined,
      }),
      "Report submitted. Document metadata is retained in mock mode."
    );
  }

  return (
    <ActionDialog
      open={report !== null}
      busy={submit.busy}
      onClose={() => {
        submit.clearError();
        onClose();
      }}
      title="Upload report submission"
      description={report && `${report.title} · due ${formatDate(report.dueDate)}`}
      error={submit.error}
    >
      <form className="space-y-3" onSubmit={send}>
        <label className="block text-sm">
          Submitted date
          <input name="date" type="date" required className={field} />
        </label>
        <label className="block text-sm">
          Document URL
          <input
            name="fileUrl"
            type="url"
            required={report?.type === "grant"}
            placeholder="https://…"
            className={field}
          />
        </label>
        <p className="text-xs text-creaw-faint">Mock mode stores document metadata only.</p>
        <Button type="submit" disabled={submit.busy}>
          Mark submitted
        </Button>
      </form>
    </ActionDialog>
  );
}
