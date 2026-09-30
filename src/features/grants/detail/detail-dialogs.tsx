"use client";
import { fieldClass } from "@/components/ui/form-styles";
import type { FormEvent } from "react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { advanceGrantAction, logGrantReportAction, recordDisbursementAction } from "../actions";
import type { GrantDetail } from "../api";

/** "Approve application" or "Mark as reviewed", matching the next sign-off step. */
export const advanceLabel = (next: GrantDetail["nextStatus"]) =>
  next === "APPROVED" ? "Approve application" : `Mark as ${next?.toLowerCase()}`;

/** Confirms the next step in the sign-off chain. */
export function AdvanceDialog({
  open,
  detail,
  onClose,
  onDone,
}: {
  open: boolean;
  detail: GrantDetail;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  return (
    <ActionDialog
      open={open}
      busy={submit.busy}
      onClose={() => {
        submit.clearError();
        onClose();
      }}
      title={advanceLabel(detail.nextStatus)}
      description={`${detail.applicant} · ${detail.project}`}
      error={submit.error}
    >
      <p className="text-sm">
        Confirm this step in the grant sign-off chain. It is recorded against your name.
      </p>
      <Button
        disabled={submit.busy}
        onClick={() =>
          detail.nextStatus &&
          void submit.run(
            advanceGrantAction({ id: detail.id, status: detail.nextStatus }),
            "Sign-off recorded."
          )
        }
      >
        Confirm sign-off
      </Button>
    </ActionDialog>
  );
}

/** Records one payment against the approved award. */
export function PaymentDialog({
  open,
  detail,
  onClose,
  onDone,
}: {
  open: boolean;
  detail: GrantDetail;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submit.run(
      recordDisbursementAction({
        applicationId: detail.id,
        amount: Number(form.get("amount")),
        date: String(form.get("date")),
        notes: String(form.get("notes") ?? ""),
      }),
      "Payment recorded."
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
      title="Record disbursement"
      description={`${detail.applicant} · approved award`}
      error={submit.error}
    >
      <form className="space-y-4" onSubmit={send}>
        <label className="block text-sm">
          Amount (KES)
          <input name="amount" type="number" min="1" step="0.01" required className={fieldClass} />
        </label>
        <label className="block text-sm">
          Payment date
          <input name="date" type="date" required className={fieldClass} />
        </label>
        <label className="block text-sm">
          Reference or note
          <input name="notes" maxLength={255} className={fieldClass} />
        </label>
        <Button disabled={submit.busy} type="submit">
          Record payment
        </Button>
      </form>
    </ActionDialog>
  );
}

/** Adds a compliance reporting period to the award. */
export function ReportPeriodDialog({
  open,
  detail,
  onClose,
  onDone,
}: {
  open: boolean;
  detail: GrantDetail;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const submit = useActionSubmit(onDone);
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submit.run(
      logGrantReportAction({
        applicationId: detail.id,
        periodStart: String(form.get("periodStart") ?? ""),
        periodEnd: String(form.get("periodEnd") ?? ""),
        dueDate: String(form.get("dueDate") ?? ""),
      }),
      "Reporting period logged."
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
      title="Log report"
      description={`${detail.applicant} · approved award`}
      error={submit.error}
    >
      <form className="space-y-4" onSubmit={send}>
        <label className="block text-sm">
          Period start
          <input name="periodStart" type="date" required className={fieldClass} />
        </label>
        <label className="block text-sm">
          Period end
          <input name="periodEnd" type="date" required className={fieldClass} />
        </label>
        <label className="block text-sm">
          Due date
          <input name="dueDate" type="date" required className={fieldClass} />
        </label>
        <Button disabled={submit.busy} type="submit">
          Add period
        </Button>
      </form>
    </ActionDialog>
  );
}
