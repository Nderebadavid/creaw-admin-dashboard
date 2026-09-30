"use client";

import { useClientPaging } from "@/components/data-table/use-client-paging";
import { FormBanner } from "@/components/ui/form-banner";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExportButton } from "@/components/ui/export-button";
import { Pagination } from "@/components/data-table/pagination";
import { auditedExportAction } from "@/components/portal/data-actions";
import { PageHeading, type PageHeadingText } from "@/components/portal/page-heading";
import { reviewSubmissionAction, viewSubmissionPhotoAction } from "./actions";
import { DocumentViewer, type ViewedDocument } from "@/components/ui/document-viewer";
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
  const [reviewing, setReviewing] = useState<SubmissionRow | null>(null);
  const [approving, setApproving] = useState<SubmissionRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [viewing, setViewing] = useState<ViewedDocument | null>(null);

  /** Opens a submission photo in the viewer; the action audits the read. */
  async function viewPhoto(row: SubmissionRow, photoId: number) {
    const result = await viewSubmissionPhotoAction(row.id, photoId);
    if (result.success && result.document) setViewing(result.document);
    else setFeedback(result.message);
  }
  // Decisions update the cards immediately; router.refresh() reconciles with the server.
  const [localRows, setLocalRows] = useState(rows);
  const filtered = useMemo(
    () => filterSubmissionRows(localRows, { status: active }),
    [localRows, active]
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
            stage_event_status: active === "All" ? undefined : stageStatusOf[active],
          },
        })
      }
    />
  );

  return (
    <div className="space-y-5">
      {heading ? <PageHeading {...heading} actions={actions || undefined} /> : actions}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Submission status">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActive(tab);
                resetPage();
              }}
              aria-pressed={active === tab}
              className={`flex items-center gap-2 rounded-[10px] border px-4 py-[9px] text-sm font-semibold ${active === tab ? "border-[#F0CDBB] bg-creaw-orange-soft text-primary" : "border-creaw-line-strong bg-white text-creaw-body"}`}
            >
              {tab}{" "}
              <span className="rounded-full border border-creaw-line bg-white px-2 py-px text-xs text-creaw-body">
                {tab === "All"
                  ? localRows.length
                  : localRows.filter((row) => row.status === tab).length}
              </span>
            </button>
          ))}
        </div>
      </div>
      <FormBanner tone="success">{feedback}</FormBanner>
      {visible.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center text-sm text-creaw-faint">
          No submissions match these filters.
        </div>
      ) : (
        <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
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
      {/* The design lists every card; paging only appears once there is more than a page. */}
      {filtered.length > pager.pageSize && <Pagination {...pager} />}
      <ReviewDialog
        submission={reviewing}
        reviewable={reviewing ? isReviewable(reviewing) : false}
        busy={busy}
        onClose={() => setReviewing(null)}
        onDecide={(decision) => reviewing && void decide(reviewing, decision)}
        onViewPhoto={(photoId) => reviewing && void viewPhoto(reviewing, photoId)}
      />
      <DocumentViewer document={viewing} onClose={() => setViewing(null)} />
      <ApproveDialog
        submission={approving}
        busy={busy}
        onClose={() => setApproving(null)}
        onConfirm={() => approving && void decide(approving, "approve")}
      />
    </div>
  );
}
