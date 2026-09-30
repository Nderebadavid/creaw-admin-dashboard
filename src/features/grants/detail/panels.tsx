import { useState } from "react";
import { CalendarX, Check, Circle, FileText, History, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";
import { daysUntil, reportStatus } from "@/features/reporting/status";
import type { GrantDetail, GrantHistoryEntry } from "../api";

const card = "rounded-2xl border border-creaw-line bg-white p-6";

const STEPS = ["Application", "Prepared", "Reviewed", "Approved"];

const HISTORY_LABEL: Record<GrantHistoryEntry["event"], string> = {
  SUBMITTED: "Application received",
  PREPARED: "Marked as prepared",
  REVIEWED: "Marked as reviewed",
  APPROVED: "Application approved",
  DECLINED: "Application declined",
};

const historyTime = (iso: string) =>
  new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });

/** Four-step sign-off track; each step is signed by a different officer. */
export function SignoffChain({
  stage,
  declined = false,
  history = [],
}: {
  stage: number;
  declined?: boolean;
  /** Who decided each step and when, oldest first. */
  history?: readonly GrantHistoryEntry[];
}) {
  const [showHistory, setShowHistory] = useState(false);
  return (
    <section className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-[22px] font-bold">Sign-off chain</h2>
        <div className="flex flex-wrap items-center gap-3.5 text-[13.5px]">
          <span className="text-creaw-faint">Separate officer per step</span>
          <button
            type="button"
            aria-expanded={showHistory}
            onClick={() => setShowHistory((shown) => !shown)}
            className="flex items-center gap-1 font-semibold text-primary"
          >
            <History size={16} aria-hidden="true" />
            {showHistory ? "Hide history" : "View history"}
          </button>
        </div>
      </div>
      <ol className="mt-5 grid grid-cols-2 gap-y-5 sm:grid-cols-4">
        {STEPS.map((step, index) => {
          // `stage` is the last completed step (ACTIVE = 0 means the application is in).
          const done = index <= stage;
          // A declined application stopped where it was: no step is current any more.
          const current = !declined && index === stage + 1;
          return (
            <li key={step} className="flex flex-col gap-2.5">
              <div className="flex items-center">
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-creaw-success bg-creaw-success text-white" : current ? "border-primary bg-creaw-orange-soft text-primary" : "border-[#DCD4CB] bg-white text-creaw-faint"}`}
                >
                  {done ? <Check size={18} /> : <Circle size={12} fill="currentColor" />}
                </span>
                {index < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`mx-2 h-[3px] flex-1 rounded ${index < stage ? "bg-creaw-success" : "bg-creaw-divider"}`}
                  />
                )}
              </div>
              <div>
                <p className="text-[15px] font-semibold">{step}</p>
                <p className="text-[13px] text-creaw-faint">
                  {done
                    ? "Signed off"
                    : current
                      ? "Current step"
                      : declined
                        ? "Not reached"
                        : "Awaiting sign-off"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {showHistory && (
        <ol
          aria-label="Sign-off history"
          className="mt-5 divide-y divide-creaw-divider border-t border-creaw-divider"
        >
          {/* Newest first, as in the audit trail. */}
          {[...history].reverse().map((entry) => (
            <li
              key={`${entry.event}-${entry.at}`}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm"
            >
              <span>
                <span className="font-semibold">{HISTORY_LABEL[entry.event]}</span>
                {entry.byName && <span className="text-creaw-body"> · {entry.byName}</span>}
              </span>
              <time dateTime={entry.at} className="text-[13px] text-creaw-faint">
                {historyTime(entry.at)}
              </time>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-xs text-creaw-faint">
        Each decision is recorded against the officer in the audit trail.
      </p>
    </section>
  );
}

/** Parses a plain or "KES"-prefixed amount; masked values (e.g. "••••") give NaN. */
const amountOf = (value: string) =>
  /^(KES\s*)?[\d,.\s]+$/i.test(value.trim()) ? Number(value.replace(/[^\d.]/g, "")) : Number.NaN;
const kes = (value: number) => `KES ${value.toLocaleString("en-KE")}`;

/** Paid-to-date against the award, with each recorded payment below. */
export function DisbursementPanel({
  detail,
  canRecord,
  busy,
  onRecord,
}: {
  detail: GrantDetail;
  canRecord: boolean;
  busy: boolean;
  onRecord: () => void;
}) {
  const award = detail.award;
  const paid = detail.disbursements.reduce((sum, item) => sum + amountOf(item.amount), 0);
  const awarded = award ? amountOf(award.amountAwarded) : Number.NaN;
  // Amounts are sensitive; when any is masked the totals stay masked too.
  const known = Number.isFinite(paid) && Number.isFinite(awarded) && awarded > 0;
  const percent = known ? Math.min(100, Math.round((paid / awarded) * 100)) : 0;

  return (
    <section className={`${card} flex flex-col gap-4`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-[22px] font-bold">Disbursement</h2>
        {award && (
          <Button
            variant="outline"
            size="sm"
            disabled={!canRecord || busy}
            title={!canRecord ? "Payment recording permission required" : undefined}
            onClick={onRecord}
          >
            <Plus size={16} />
            Record payment
          </Button>
        )}
      </div>
      {award ? (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-1.5">
              <span className="font-heading text-[32px] font-bold">
                {known ? kes(paid) : "KES ••••"}
              </span>
              <span className="text-sm text-creaw-faint">
                of {known ? kes(awarded) : `${award.currency} ${award.amountAwarded}`} awarded
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Disbursed"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-3 overflow-hidden rounded-full bg-[#F4EEE8]"
            >
              <div className="h-full rounded-full bg-[#F2B25C]" style={{ width: `${percent}%` }} />
            </div>
          </div>
          <ul>
            {detail.disbursements.map((item, index) => (
              <li
                key={item.id}
                className="flex items-center justify-between border-b border-creaw-divider py-2.5 text-sm last:border-b-0"
              >
                <div>
                  <p className="font-semibold">{item.notes || `Payment ${index + 1}`}</p>
                  <p className="text-[13px] text-creaw-faint">
                    {item.date ? formatDate(item.date) : "Date pending"}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">
                  {Number.isFinite(amountOf(item.amount))
                    ? kes(amountOf(item.amount))
                    : item.amount}
                </span>
              </li>
            ))}
          </ul>
          {!detail.disbursements.length && (
            <p className="text-sm text-creaw-faint">No payments recorded.</p>
          )}
        </>
      ) : (
        <p className="rounded-[10px] bg-creaw-canvas p-3 text-[13.5px] text-creaw-faint">
          Disbursement opens once the application is approved.
        </p>
      )}
    </section>
  );
}

/** Reporting periods owed on the award; logging is locked until an award exists. */
export function ComplianceReports({
  detail,
  canLog,
  busy,
  onLog,
}: {
  detail: GrantDetail;
  canLog: boolean;
  busy: boolean;
  onLog: () => void;
}) {
  const awarded = detail.reportingAwardId !== null;
  return (
    <section className={`${card} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-[22px] font-bold">Compliance reports</h2>
          <p className="mt-0.5 text-[13.5px] text-creaw-faint">
            Periodic reports owed to the donor on this award
          </p>
        </div>
        {awarded ? (
          <Button
            variant="outline"
            size="sm"
            disabled={!canLog || busy}
            title={!canLog ? "Grant report management permission required" : undefined}
            onClick={onLog}
          >
            <Plus size={16} />
            Log report
          </Button>
        ) : (
          <span className="flex h-9 items-center gap-1.5 rounded-[9px] border border-dashed border-[#DCD4CB] px-3 text-[13.5px] font-semibold text-[#A39A92]">
            <Lock size={15} aria-hidden="true" />
            Log report · locked until awarded
          </span>
        )}
      </div>
      {detail.reports.map((report) => {
        const status = reportStatus({
          status: report.submittedDate
            ? "submitted"
            : daysUntil(report.dueDate) < 0
              ? "overdue"
              : "pending",
          dueDate: report.dueDate,
        });
        const late = status.tone === "danger";
        return (
          <div
            key={report.id}
            className={`flex flex-wrap items-center gap-3.5 rounded-xl px-3.5 py-3 ${late ? "border-[1.5px] border-dashed border-[#F3CCC6] bg-[#FFF8F6]" : "border border-creaw-divider bg-white"}`}
          >
            <span
              aria-hidden="true"
              className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] ${late ? "bg-creaw-danger-soft text-creaw-danger" : "bg-creaw-canvas text-primary"}`}
            >
              {late ? <CalendarX size={20} /> : <FileText size={20} />}
            </span>
            <div className="min-w-44 flex-1">
              <p className="text-[14.5px] font-semibold">
                Reporting period {formatDate(report.periodStart)} – {formatDate(report.periodEnd)}
              </p>
              <p className="text-[13px] text-creaw-faint">
                {report.submittedDate
                  ? `Submitted ${formatDate(report.submittedDate)} · due ${formatDate(report.dueDate)}`
                  : `Due ${formatDate(report.dueDate)}${late ? ` · ${-daysUntil(report.dueDate)} days late` : ""}`}
              </p>
            </div>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </div>
        );
      })}
      {!detail.reports.length && (
        <p className="rounded-[10px] bg-creaw-canvas p-3 text-[13.5px] leading-normal text-creaw-faint">
          {awarded
            ? "No reporting periods logged yet."
            : "Reporting periods open once the application is approved and awarded."}
        </p>
      )}
    </section>
  );
}
