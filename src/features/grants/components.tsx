"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, FileDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { DocumentPanel } from "@/components/ui/document-panel";
import { ExportButton } from "@/components/ui/export-button";
import type { GrantDetail, GrantPage, GrantQuery, GrantRow } from "./api";
import {
  advanceGrantAction,
  downloadGrantPackAction,
  exportGrantsAction,
  listGrantsAction,
  logGrantReportAction,
  recordDisbursementAction,
  viewGrantDocumentAction,
} from "./actions";

const date = (value: string) =>
  new Date(value).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
const tone = (status: string) =>
  status === "APPROVED"
    ? ("success" as const)
    : status === "REVIEWED"
      ? ("warning" as const)
      : ("neutral" as const);
export function GrantsContent({
  initial,
  pillars,
  canExport,
}: {
  initial: GrantPage;
  pillars: { id: number; name: string }[];
  canExport: boolean;
}) {
  const [data, setData] = useState(initial),
    [query, setQuery] = useState<GrantQuery>({ page: 1, pageSize: 25 });
  const [search, setSearch] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let active = true;
    const timer = setTimeout(
      async () => {
        const response = await listGrantsAction(query);
        if (!active) return;
        if (response.success && response.data) {
          setData(response.data);
          setError("");
        } else setError(response.message);
        setLoading(false);
      },
      query.search ? 250 : 0
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  const filter = (patch: Partial<GrantQuery>) => {
    setLoading(true);
    setQuery((current) => ({ ...current, ...patch, page: 1 }));
  };
  const columns: DataColumn<GrantRow>[] = [
    {
      id: "applicant",
      header: "Applicant",
      cell: (row) => <span className="font-semibold">{row.applicant}</span>,
    },
    { id: "project", header: "Programme", cell: (row) => row.project },
    { id: "requested", header: "Requested", cell: (row) => row.requestedAmount },
    { id: "type", header: "Grant type", cell: (row) => row.grantType.replaceAll("_", " ") },
    { id: "date", header: "Applied", cell: (row) => date(row.createdAt) },
    {
      id: "stage",
      header: "Stage",
      cell: (row) => <StatusBadge tone={tone(row.status)}>{row.status}</StatusBadge>,
    },
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-bold">Grant applications</h2>
          <p className="text-sm text-creaw-muted">Prepared → Reviewed → Approved sign-off chain</p>
        </div>
        {canExport && <ExportButton exportAction={() => exportGrantsAction(query)} />}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Grant stage">
        {["All", "ACTIVE", "PREPARED", "REVIEWED", "APPROVED"].map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={(query.status ?? "All") === status}
            className={`rounded-full border px-3 py-1.5 text-sm ${(query.status ?? "All") === status ? "bg-creaw-orange-soft text-primary" : "bg-white"}`}
            onClick={() => filter({ status: status === "All" ? undefined : status })}
          >
            {status === "ACTIVE" ? "New" : status[0] + status.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex min-w-56 flex-1 items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm">
          <Search size={16} aria-hidden />
          <span className="sr-only">Search grants</span>
          <input
            value={search}
            type="search"
            onChange={(event) => {
              setSearch(event.target.value);
              filter({ search: event.target.value || undefined });
            }}
            placeholder="Search applications…"
            className="min-w-0 flex-1 outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          Pillar
          <select
            aria-label="Pillar"
            value={query.pillarId ?? ""}
            onChange={(event) => filter({ pillarId: Number(event.target.value) || undefined })}
            className="rounded-xl border bg-white px-3 py-2"
          >
            <option value="">All pillars</option>
            {pillars.map((pillar) => (
              <option key={pillar.id} value={pillar.id}>
                {pillar.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-creaw-danger-soft p-3 text-sm text-creaw-danger">
          {error}
        </p>
      )}
      <DataTable
        label="Grant applications"
        columns={columns}
        rows={data.items}
        getRowId={(row) => row.id}
        loading={loading}
        filtered={Boolean(query.pillarId || query.status || query.search)}
        rowActions={(row) => (
          <Link
            className="whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-semibold text-primary"
            href={`/grants/${row.id}`}
          >
            Open application
          </Link>
        )}
      />
      <Pagination
        page={data.page}
        pageSize={data.pageSize as PageSize}
        totalItems={data.totalItems}
        onPageChange={(page) => {
          setLoading(true);
          setQuery((current) => ({ ...current, page }));
        }}
        onPageSizeChange={(pageSize) => {
          setLoading(true);
          setQuery((current) => ({ ...current, pageSize, page: 1 }));
        }}
      />
    </div>
  );
}

export function GrantDetailContent({
  detail,
  canAdvance,
  canDisburse,
  canDownload,
  canLogReport,
}: {
  detail: GrantDetail;
  canAdvance: boolean;
  canDisburse: boolean;
  canDownload: boolean;
  canLogReport: boolean;
}) {
  const [modal, setModal] = useState<"advance" | "payment" | "report" | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState("");
  async function advance() {
    if (!detail.nextStatus) return;
    setBusy(true);
    const response = await advanceGrantAction({ id: detail.id, status: detail.nextStatus });
    setBusy(false);
    if (response.success) {
      setFeedback("Sign-off recorded. Refresh the page to view the updated stage.");
      setModal(null);
    } else setError(response.message);
  }
  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const response = await recordDisbursementAction({
      applicationId: detail.id,
      amount: Number(form.get("amount")),
      date: String(form.get("date")),
      notes: String(form.get("notes") ?? ""),
    });
    setBusy(false);
    if (response.success) {
      setFeedback("Payment recorded. Refresh the page to view the schedule.");
      setModal(null);
    } else setError(response.message);
  }
  async function pack() {
    setBusy(true);
    const response = await downloadGrantPackAction(detail.id);
    setBusy(false);
    if (response.success)
      setFeedback("Application pack access audited. Mock mode provides metadata only.");
    else setError(response.message);
  }
  async function viewDocument(id: number) {
    setBusy(true);
    const response = await viewGrantDocumentAction(detail.id, id);
    setBusy(false);
    if (response.success) setFeedback("Document access audited. Mock mode provides metadata only.");
    else setError(response.message);
  }
  async function logReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const response = await logGrantReportAction({
      applicationId: detail.id,
      periodStart: String(form.get("periodStart") ?? ""),
      periodEnd: String(form.get("periodEnd") ?? ""),
      dueDate: String(form.get("dueDate") ?? ""),
    });
    setBusy(false);
    if (response.success) {
      setFeedback("Reporting period logged. Refresh the page to view it.");
      setModal(null);
    } else setError(response.message);
  }
  return (
    <div className="space-y-5">
      <Link
        href="/grants"
        className="inline-flex items-center gap-2 text-sm font-semibold text-creaw-body"
      >
        <ArrowLeft size={16} />
        All applications
      </Link>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-6">
        <div>
          <h2 className="font-heading text-2xl font-bold">{detail.applicant}</h2>
          <p className="text-sm text-creaw-muted">
            {detail.project} · {detail.grantType.replaceAll("_", " ")} · {detail.requestedAmount}{" "}
            requested
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={tone(detail.status)}>{detail.status}</StatusBadge>
          <Button
            variant="outline"
            disabled={!canDownload || busy}
            title={!canDownload ? "Document download permission required" : undefined}
            onClick={pack}
          >
            <FileDown size={16} />
            Application pack
          </Button>
          {detail.nextStatus && (
            <Button
              disabled={!canAdvance || busy}
              title={!canAdvance ? "Permission required for this sign-off step" : undefined}
              onClick={() => setModal("advance")}
            >
              {detail.nextStatus === "APPROVED"
                ? "Approve application"
                : `Mark as ${detail.nextStatus.toLowerCase()}`}
            </Button>
          )}
        </div>
      </section>
      {feedback && (
        <p
          role="status"
          className="rounded-xl bg-creaw-success-soft p-3 text-sm text-creaw-success"
        >
          {feedback}
        </p>
      )}
      {error && !modal && (
        <p role="alert" className="rounded-xl bg-creaw-danger-soft p-3 text-sm text-creaw-danger">
          {error}
        </p>
      )}
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-heading text-xl font-bold">Sign-off chain</h2>
        <p className="text-xs text-creaw-muted">
          Stages reflect application status; accountable officers are retained in the audit trail.
        </p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-4">
          {["Application", "Prepared", "Reviewed", "Approved"].map((step, index) => (
            <li
              key={step}
              className={`rounded-xl border p-3 ${index <= detail.stage ? "border-[#E8C6B5] bg-[#FCF4EF]" : "bg-creaw-surface"}`}
            >
              <span className="mb-2 inline-flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                {index + 1}
              </span>
              <p className="font-semibold">{step}</p>
              <p className="text-xs text-creaw-muted">
                {index < detail.stage
                  ? "Complete"
                  : index === detail.stage
                    ? "Current stage"
                    : "Awaiting sign-off"}
              </p>
            </li>
          ))}
        </ol>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <DocumentPanel
          documents={detail.documents.map((doc) => ({
            id: doc.id,
            name: doc.name,
            requirement: doc.name,
            action: (
              <Button
                key={doc.id}
                size="sm"
                variant="outline"
                disabled={!canDownload || busy}
                onClick={() => void viewDocument(doc.id)}
              >
                View
              </Button>
            ),
          }))}
          requirements={["business plan"]}
        />
        <section className="rounded-2xl border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-xl font-bold">Disbursement</h2>
            <Button
              variant="outline"
              disabled={!canDisburse || !detail.award || busy}
              title={
                !canDisburse
                  ? "Payment recording permission required"
                  : !detail.award
                    ? "Approval required"
                    : undefined
              }
              onClick={() => setModal("payment")}
            >
              Record payment
            </Button>
          </div>
          {detail.award ? (
            <>
              <p className="mt-3 text-sm text-creaw-muted">
                Awarded: {detail.award.currency} {detail.award.amountAwarded} ·{" "}
                {detail.award.lifecycle}
              </p>
              <ul className="mt-3 space-y-2">
                {detail.disbursements.map((item) => (
                  <li key={item.id} className="rounded-xl border bg-creaw-surface p-3 text-sm">
                    <span className="font-semibold">{item.amount}</span> ·{" "}
                    {item.date ? date(item.date) : "Date pending"}
                    {item.notes && <p className="text-xs text-creaw-muted">{item.notes}</p>}
                  </li>
                ))}
              </ul>
              {!detail.disbursements.length && (
                <p className="mt-3 text-sm text-creaw-muted">No payments recorded.</p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-creaw-muted">
              Disbursement opens once the application is approved.
            </p>
          )}
        </section>
      </div>
      <section className="rounded-2xl border bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-xl font-bold">Grant reporting periods</h2>
          <Button
            variant="outline"
            disabled={!canLogReport || !detail.reportingAwardId || busy}
            title={
              !canLogReport
                ? "Grant report management permission required"
                : !detail.reportingAwardId
                  ? "Approval required"
                  : undefined
            }
            onClick={() => setModal("report")}
          >
            Log reporting period
          </Button>
        </div>
        {detail.reports.length ? (
          <ul className="mt-3 space-y-2">
            {detail.reports.map((report) => (
              <li key={report.id} className="rounded-xl border bg-creaw-surface p-3 text-sm">
                {date(report.periodStart)} – {date(report.periodEnd)} · due {date(report.dueDate)}{" "}
                <StatusBadge tone={report.submittedDate ? "success" : "warning"}>
                  {report.submittedDate ? "Submitted" : "Pending"}
                </StatusBadge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-creaw-muted">
            {detail.reportingAwardId
              ? "No reporting periods logged yet."
              : "Reporting opens once an award exists."}
          </p>
        )}
      </section>
      <Dialog
        open={modal === "advance"}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setModal(null);
            setError("");
          }
        }}
      >
        <DialogContent>
          <DialogTitle>
            {detail.nextStatus === "APPROVED"
              ? "Approve application"
              : `Mark as ${detail.nextStatus?.toLowerCase()}`}
          </DialogTitle>
          <DialogDescription>
            {detail.applicant} · {detail.project}
          </DialogDescription>
          {error && <p role="alert">{error}</p>}
          <p className="text-sm">Confirm this step in the grant sign-off chain.</p>
          <Button disabled={busy} onClick={advance}>
            Confirm sign-off
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={modal === "payment"}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setModal(null);
            setError("");
          }
        }}
      >
        <DialogContent>
          <DialogTitle>Record disbursement</DialogTitle>
          <DialogDescription>{detail.applicant} · approved award</DialogDescription>
          {error && <p role="alert">{error}</p>}
          <form className="space-y-4" onSubmit={pay}>
            <label className="block text-sm">
              Amount (KES)
              <input
                name="amount"
                type="number"
                min="1"
                step="0.01"
                required
                className="mt-1 w-full rounded-lg border p-2"
              />
            </label>
            <label className="block text-sm">
              Payment date
              <input
                name="date"
                type="date"
                required
                className="mt-1 w-full rounded-lg border p-2"
              />
            </label>
            <label className="block text-sm">
              Reference or note
              <input name="notes" maxLength={255} className="mt-1 w-full rounded-lg border p-2" />
            </label>
            <Button disabled={busy} type="submit">
              Record payment
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={modal === "report"}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setModal(null);
            setError("");
          }
        }}
      >
        <DialogContent>
          <DialogTitle>Log reporting period</DialogTitle>
          <DialogDescription>{detail.applicant} · approved award</DialogDescription>
          {error && <p role="alert">{error}</p>}
          <form className="space-y-4" onSubmit={logReport}>
            <label className="block text-sm">
              Period start
              <input
                name="periodStart"
                type="date"
                required
                className="mt-1 w-full rounded-lg border p-2"
              />
            </label>
            <label className="block text-sm">
              Period end
              <input
                name="periodEnd"
                type="date"
                required
                className="mt-1 w-full rounded-lg border p-2"
              />
            </label>
            <label className="block text-sm">
              Due date
              <input
                name="dueDate"
                type="date"
                required
                className="mt-1 w-full rounded-lg border p-2"
              />
            </label>
            <Button disabled={busy} type="submit">
              Add period
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
