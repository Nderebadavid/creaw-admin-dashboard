"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Flag, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ExportButton } from "@/components/ui/export-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { auditedExportAction } from "@/components/portal/data-actions";
import { reviewSubmissionAction } from "./actions";
import type { SubmissionRow, SubmissionStatus } from "./api";
import { filterSubmissionRows } from "./filter";

const tabs: ("All" | SubmissionStatus)[] = ["All", "Pending review", "Flagged", "Approved"];
const tone: Record<SubmissionStatus, "warning" | "danger" | "success"> = {
  "Pending review": "warning",
  Flagged: "danger",
  Approved: "success",
};

export function SubmissionsContent({
  rows,
  canReview = false,
  reviewableIds,
  canExport = false,
  exportableIds,
}: {
  rows: SubmissionRow[];
  canReview?: boolean;
  reviewableIds?: readonly number[];
  canExport?: boolean;
  exportableIds?: readonly number[];
}) {
  const router = useRouter();
  const [active, setActive] = useState<"All" | SubmissionStatus>("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [selected, setSelected] = useState<SubmissionRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [localRows, setLocalRows] = useState(rows);
  const filtered = useMemo(
    () => filterSubmissionRows(localRows, { status: active, search }),
    [localRows, active, search]
  );
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  async function decide(decision: "approve" | "flag") {
    if (!selected) return;
    setBusy(true);
    setFeedback("");
    try {
      const result = await reviewSubmissionAction(selected.id, decision);
      setFeedback(result.message);
      if (result.success) {
        const status = decision === "approve" ? "Approved" : "Flagged";
        setLocalRows((current) =>
          current.map((row) => (row.id === selected.id ? { ...row, status } : row))
        );
        setSelected(null);
        router.refresh();
      }
    } catch {
      setFeedback("Submission review failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const stageStatus =
    active === "All"
      ? undefined
      : ({ "Pending review": "recorded", Flagged: "disputed", Approved: "verified" } as const)[
          active
        ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-bold">Review queue</h2>
          <p className="text-sm text-[#81766d]">
            Mobile updates linked to existing programme records
          </p>
        </div>
        {canExport &&
          filtered.length > 0 &&
          (!exportableIds || filtered.every((row) => exportableIds.includes(row.id))) && (
            <ExportButton
              exportAction={() =>
                auditedExportAction({
                  path: "/field-submissions",
                  routeTemplate: "/field-submissions",
                  query: { search: search || undefined, stage_event_status: stageStatus },
                })
              }
            />
          )}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Submission status">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActive(tab);
              setPage(1);
            }}
            aria-pressed={active === tab}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${active === tab ? "border-[#F0CDBB] bg-[#FBEDE5] text-primary" : "bg-white text-[#6B625B]"}`}
          >
            {tab}{" "}
            <span className="ml-1 text-xs">
              {tab === "All"
                ? localRows.length
                : localRows.filter((row) => row.status === tab).length}
            </span>
          </button>
        ))}
      </div>
      <label className="flex max-w-sm items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Search submissions</span>
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search submissions…"
          className="min-w-0 flex-1 outline-none"
        />
      </label>
      {feedback && (
        <p
          role="status"
          className="rounded-xl border border-[#D5E8D9] bg-[#EAF5ED] px-4 py-3 text-sm text-[#246842]"
        >
          {feedback}
        </p>
      )}
      {visible.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center text-sm text-[#81766d]">
          No submissions match these filters.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((row) => {
            const reviewable = reviewableIds ? reviewableIds.includes(row.id) : canReview;
            return (
              <article key={row.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-[#FBEDE5] px-2.5 py-1 text-xs font-semibold text-primary">
                    <Camera size={14} />
                    {row.type}
                  </span>
                  <StatusBadge tone={tone[row.status]}>{row.status}</StatusBadge>
                </div>
                <h3 className="mt-4 font-heading text-xl font-bold">{row.title}</h3>
                <p className="mt-1 text-sm text-[#81766d]">
                  {row.pillar} · Captured{" "}
                  {new Date(row.captured).toLocaleDateString("en-KE", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <p className="mt-2 flex items-center gap-1 text-xs text-[#81766d]">
                  <MapPin size={13} aria-hidden="true" />
                  Location not recorded in this event
                </p>
                {row.flag && (
                  <p className="mt-3 rounded-lg bg-[#fff1d8] px-3 py-2 text-xs text-[#94570d]">
                    Flag: {row.flag}
                  </p>
                )}
                <div className="mt-5 border-t pt-4">
                  <Button
                    variant="outline"
                    disabled={!reviewable || row.status === "Approved"}
                    title={
                      !reviewable
                        ? "You do not have review permission"
                        : row.status === "Approved"
                          ? "Already approved"
                          : undefined
                    }
                    onClick={() => setSelected(row)}
                    aria-label={`Review ${row.title}`}
                  >
                    Review submission →
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>{selected?.title}</DialogTitle>
          <DialogDescription>
            {selected?.pillar} · {selected?.type} · Captured via {selected?.source}
          </DialogDescription>
          {selected && (
            <div className="space-y-4 text-sm">
              <p>Review the mobile update before merging it into the linked programme record.</p>
              {selected.flag && (
                <p className="rounded-lg bg-[#fff1d8] p-3">Flag: {selected.flag}</p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" disabled={busy} onClick={() => decide("flag")}>
                  <Flag size={16} />
                  Flag for follow-up
                </Button>
                <Button disabled={busy} onClick={() => decide("approve")}>
                  <Check size={16} />
                  Approve submission
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
