"use client";

import { useClientPaging } from "@/components/data-table/use-client-paging";
import { FormBanner } from "@/components/ui/form-banner";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { ExportButton } from "@/components/ui/export-button";
import { Pagination } from "@/components/data-table/pagination";
import { auditedExportAction } from "@/components/portal/data-actions";
import { PageHeading, type PageHeadingText } from "@/components/portal/page-heading";
import { reviewSubmissionAction } from "./actions";
import type { SubmissionRow, SubmissionStatus } from "./api";
import { filterSubmissionRows } from "./filter";
import { SubmissionCard } from "./queue/submission-card";
import { ApproveDialog, ReviewDialog, type Decision } from "./queue/review-dialogs";

const tabs: ("All" | SubmissionStatus)[] = ["All", "Pending review", "Flagged", "Approved"];
/** Tab → stage_event_status, for exporting exactly what the tab shows. */
const stageStatusOf = {
  "Pending review": "recorded",
  Flagged: "disputed",
  Approved: "verified",
} as const;

/**
 * Field submissions from the mobile app, as cards filtered by review status.
 * Approving merges the update into its linked programme record.
 */
export function SubmissionsContent({
  heading,
  rows,
  canReview = false,
  reviewableIds,
  canExport = false,
  exportableIds,
}: {
  heading?: PageHeadingText;
  rows: SubmissionRow[];
  canReview?: boolean;
  /** Submissions in pillars the user may review; overrides `canReview` when given. */
  reviewableIds?: readonly number[];
  canExport?: boolean;
  /** Submissions the user may export; export shows only when every visible row is exportable. */
  exportableIds?: readonly number[];
}) {
  const router = useRouter();
  const [active, setActive] = useState<"All" | SubmissionStatus>("All");
  const [search, setSearch] = useState("");
  const [reviewing, setReviewing] = useState<SubmissionRow | null>(null);
  const [approving, setApproving] = useState<SubmissionRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  // Decisions update the cards immediately; router.refresh() reconciles with the server.
  const [localRows, setLocalRows] = useState(rows);
  const filtered = useMemo(
    () => filterSubmissionRows(localRows, { status: active, search }),
    [localRows, active, search]
  );
  const { pageRows: visible, pager, resetPage } = useClientPaging(filtered);
  const isReviewable = (row: SubmissionRow) =>
    reviewableIds ? reviewableIds.includes(row.id) : canReview;

  async function decide(row: SubmissionRow, decision: Decision) {
    setBusy(true);
    setFeedback("");
    try {
      const result = await reviewSubmissionAction(row.id, decision);
      setFeedback(result.message);
      if (result.success) {
        const status = decision === "approve" ? "Approved" : "Flagged";
        setLocalRows((current) =>
          current.map((item) => (item.id === row.id ? { ...item, status } : item))
        );
        setReviewing(null);
        setApproving(null);
        router.refresh();
      }
    } catch {
      setFeedback("Submission review failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const exportable =
    canExport &&
    filtered.length > 0 &&
    (!exportableIds || filtered.every((row) => exportableIds.includes(row.id)));
  const actions = exportable && (
    <ExportButton
      exportAction={() =>
        auditedExportAction({
          path: "/field-submissions",
          routeTemplate: "/field-submissions",
          query: {
            search: search || undefined,
            stage_event_status: active === "All" ? undefined : stageStatusOf[active],
          },
        })
      }
    />
  );

  return (
    <div className="space-y-5">
      {heading ? <PageHeading {...heading} actions={actions || undefined} /> : actions}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Submission status">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActive(tab);
                resetPage();
              }}
              aria-pressed={active === tab}
              className={`rounded-[9px] border px-3 py-[7px] text-[13px] font-semibold ${active === tab ? "border-[#F0CDBB] bg-creaw-orange-soft text-primary" : "border-creaw-line-strong bg-white text-creaw-body"}`}
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
        <label className="flex h-10 w-60 max-w-full items-center gap-2 rounded-[10px] border border-creaw-line bg-white px-3 text-sm">
          <Search size={18} aria-hidden="true" className="text-creaw-faint" />
          <span className="sr-only">Search submissions</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
            placeholder="Filter this list"
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
      </div>
      <FormBanner tone="success">{feedback}</FormBanner>
      {visible.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center text-sm text-creaw-faint">
          No submissions match these filters.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((row) => (
            <SubmissionCard
              key={row.id}
              row={row}
              reviewable={isReviewable(row)}
              onReview={() => setReviewing(row)}
              onApprove={() => setApproving(row)}
            />
          ))}
        </div>
      )}
      <Pagination {...pager} />
      <ReviewDialog
        submission={reviewing}
        busy={busy}
        onClose={() => setReviewing(null)}
        onDecide={(decision) => reviewing && void decide(reviewing, decision)}
      />
      <ApproveDialog
        submission={approving}
        busy={busy}
        onClose={() => setApproving(null)}
        onConfirm={() => approving && void decide(approving, "approve")}
      />
    </div>
  );
}
