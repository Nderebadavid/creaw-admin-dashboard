"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CalendarDays, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertBanner } from "@/components/ui/alert-banner";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { ExportButton } from "@/components/ui/export-button";
import type { ReportPage, ReportQuery, ReportView } from "./api";
import {
  addDeadlineAction,
  exportReportsAction,
  listReportsAction,
  submitReportAction,
  viewReportDocumentAction,
} from "./actions";

type Catalog = {
  projects: { id: number; pillar_id: number; name: string; donor_id: number | null }[];
  pillars: { id: number; name: string; lead_user_id: number | null }[];
  owners?: { id: number; name: string }[];
};
const date = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
export function ReportingContent({
  initial,
  catalog,
  canManage,
  canExport,
  narrativePillars = [],
  grantPillars = [],
}: {
  initial: ReportPage;
  catalog: Catalog;
  canManage: boolean;
  canExport: boolean;
  narrativePillars?: number[];
  grantPillars?: number[];
}) {
  const [data, setData] = useState(initial),
    [query, setQuery] = useState<ReportQuery>({ page: 1, pageSize: 25 }),
    [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState("");
  const [selected, setSelected] = useState<ReportView | null>(null),
    [modal, setModal] = useState<"deadline" | "submit" | null>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let active = true;
    const timer = setTimeout(
      async () => {
        const response = await listReportsAction(query);
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
  const filter = (patch: Partial<ReportQuery>) => {
    setLoading(true);
    setQuery((current) => ({ ...current, ...patch, page: 1 }));
  };
  async function refresh() {
    const response = await listReportsAction(query);
    if (response.success && response.data) setData(response.data);
    else setError(response.message);
  }
  async function addDeadline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const response = await addDeadlineAction({
      projectId: Number(form.get("projectId")),
      title: String(form.get("title") ?? ""),
      periodStart: String(form.get("periodStart") ?? ""),
      periodEnd: String(form.get("periodEnd") ?? ""),
    });
    setBusy(false);
    if (response.success) {
      setFeedback("Reporting deadline added.");
      setModal(null);
      void refresh();
    } else setError(response.message);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const response = await submitReportAction({
      type: selected.type,
      id: selected.id,
      date: String(form.get("date") ?? ""),
      fileUrl: String(form.get("fileUrl") ?? "") || undefined,
    });
    setBusy(false);
    if (response.success) {
      setFeedback("Report submitted. Document metadata is retained in mock mode.");
      setModal(null);
      void refresh();
    } else setError(response.message);
  }
  async function viewDocument(row: ReportView) {
    const response = await viewReportDocumentAction(row.type, row.id);
    if (response.success) setFeedback("Document access audited. Mock mode provides metadata only.");
    else setError(response.message);
  }
  const overdue = data.items.filter((row) => row.status === "overdue").length;
  const owners = [
    ...new Set(
      catalog.pillars.map((pillar) => pillar.lead_user_id).filter((id): id is number => id !== null)
    ),
  ];
  const columns: DataColumn<ReportView>[] = [
    {
      id: "report",
      header: "Report",
      cell: (row) => (
        <div>
          <span className="font-semibold">{row.title}</span>
          <p className="text-xs text-creaw-muted">
            {row.type === "grant" ? "Grant compliance" : "Narrative report"}
          </p>
        </div>
      ),
    },
    { id: "programme", header: "Programme", cell: (row) => row.project },
    { id: "pillar", header: "Pillar", cell: (row) => row.pillar },
    {
      id: "due",
      header: "Due",
      cell: (row) => (
        <span className={row.status === "overdue" ? "font-semibold text-creaw-danger" : ""}>
          {date(row.dueDate)}
        </span>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      cell: (row) => row.ownerName ?? (row.ownerId ? `Staff #${row.ownerId}` : "Unassigned"),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge
          tone={
            row.status === "submitted" ? "success" : row.status === "overdue" ? "danger" : "warning"
          }
        >
          {row.status}
        </StatusBadge>
      ),
    },
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-bold">Reporting calendar</h2>
          <p className="text-sm text-creaw-muted">Donor and grant reports across pillars</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport && <ExportButton exportAction={() => exportReportsAction(query)} />}
          {canManage && (
            <Button
              onClick={() => {
                setError("");
                setModal("deadline");
              }}
            >
              <CalendarDays size={16} />
              Add deadline
            </Button>
          )}
        </div>
      </div>
      {overdue > 0 && (
        <AlertBanner tone="danger">
          <strong>
            {overdue} report{overdue === 1 ? "" : "s"} overdue
          </strong>
          <span className="ml-2">Follow up with the owner and submit the report.</span>
        </AlertBanner>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Report status">
        {["All", "overdue", "pending", "submitted"].map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={(query.status ?? "All") === status}
            onClick={() => filter({ status: status === "All" ? undefined : status })}
            className={`rounded-full border px-3 py-1.5 text-sm ${(query.status ?? "All") === status ? "bg-creaw-orange-soft text-primary" : "bg-white"}`}
          >
            {status[0].toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex min-w-56 flex-1 items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm">
          <Search size={16} aria-hidden />
          <span className="sr-only">Search reports</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              filter({ search: event.target.value || undefined });
            }}
            placeholder="Search reports…"
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
            {catalog.pillars.map((pillar) => (
              <option key={pillar.id} value={pillar.id}>
                {pillar.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Owner
          <select
            aria-label="Owner"
            value={query.ownerId ?? ""}
            onChange={(event) => filter({ ownerId: Number(event.target.value) || undefined })}
            className="rounded-xl border bg-white px-3 py-2"
          >
            <option value="">All owners</option>
            {owners.map((id) => (
              <option key={id} value={id}>
                {catalog.owners?.find((owner) => owner.id === id)?.name ?? `Staff #${id}`}
              </option>
            ))}
          </select>
        </label>
      </div>
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
      <DataTable
        label="Reports due"
        columns={columns}
        rows={data.items}
        getRowId={(row) => row.key}
        loading={loading}
        filtered={Boolean(query.pillarId || query.ownerId || query.status || query.search)}
        rowActions={(row) =>
          row.status === "submitted" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={!row.documentId}
              title={!row.documentId ? "No document attached" : undefined}
              onClick={() => void viewDocument(row)}
            >
              View document
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={
                !(row.type === "grant" ? grantPillars : narrativePillars).includes(row.pillarId)
              }
              title={
                !(row.type === "grant" ? grantPillars : narrativePillars).includes(row.pillarId)
                  ? "Report management permission required"
                  : undefined
              }
              onClick={() => {
                setSelected(row);
                setError("");
                setModal("submit");
              }}
            >
              Upload submission
            </Button>
          )
        }
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
      <Dialog
        open={modal === "deadline"}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setModal(null);
            setError("");
          }
        }}
      >
        <DialogContent>
          <DialogTitle>Add reporting deadline</DialogTitle>
          <DialogDescription>
            The selected project determines its pillar and owner.
          </DialogDescription>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <form className="space-y-3" onSubmit={addDeadline}>
            <label className="block text-sm">
              Report title
              <input
                name="title"
                required
                maxLength={255}
                className="mt-1 w-full rounded-lg border p-2"
              />
            </label>
            <label className="block text-sm">
              Programme
              <select name="projectId" required className="mt-1 w-full rounded-lg border p-2">
                {catalog.projects
                  .filter((project) => narrativePillars.includes(project.pillar_id))
                  .map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
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
                Due / period end
                <input
                  name="periodEnd"
                  type="date"
                  required
                  className="mt-1 w-full rounded-lg border p-2"
                />
              </label>
            </div>
            <Button type="submit" disabled={busy}>
              Add deadline
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={modal === "submit"}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setModal(null);
            setError("");
          }
        }}
      >
        <DialogContent>
          <DialogTitle>Upload report submission</DialogTitle>
          <DialogDescription>
            {selected?.title} · due {selected && date(selected.dueDate)}
          </DialogDescription>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <form className="space-y-3" onSubmit={submit}>
            <label className="block text-sm">
              Submitted date
              <input
                name="date"
                type="date"
                required
                className="mt-1 w-full rounded-lg border p-2"
              />
            </label>
            <label className="block text-sm">
              Document URL
              <input
                name="fileUrl"
                type="url"
                required={selected?.type === "grant"}
                placeholder="https://…"
                className="mt-1 w-full rounded-lg border p-2"
              />
            </label>
            <p className="text-xs text-creaw-muted">Mock mode stores document metadata only.</p>
            <Button type="submit" disabled={busy}>
              Mark submitted
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
