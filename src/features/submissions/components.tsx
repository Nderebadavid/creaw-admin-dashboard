"use client";

import { LocationFilter } from "@/components/data-table/location-filter";
import { locationParams } from "@/lib/api/location";
import { usePagedList } from "@/components/data-table/use-paged-list";
import { FormBanner } from "@/components/ui/form-banner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExportButton } from "@/components/ui/export-button";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { auditedExportAction } from "@/components/portal/data-actions";
import { PageHeading, type PageHeadingText } from "@/components/portal/page-heading";
import {
  listSubmissionsAction,
  reviewSubmissionAction,
  viewSubmissionPhotoAction,
} from "./actions";
import { DocumentViewer, type ViewedDocument } from "@/components/ui/document-viewer";
import type { SubmissionList, SubmissionQuery, SubmissionRow, SubmissionStatus } from "./api";
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
  initial,
  reviewablePillarIds = [],
  canExport = false,
  exportablePillarIds,
}: {
  heading?: PageHeadingText;
  /** The first page, rendered by the server. */
  initial: SubmissionList;
  /** Pillars whose submissions the user may review. */
  reviewablePillarIds?: readonly number[];
  canExport?: boolean;
  /** Pillars whose submissions the user may export; export shows only when every shown card is exportable. */
  exportablePillarIds?: readonly number[];
}) {
  const router = useRouter();
  const list = usePagedList<SubmissionRow, SubmissionQuery>(
    initial,
    { page: 1, pageSize: initial.pageSize },
    listSubmissionsAction
  );
  const active = (list.query.status ?? "All") as "All" | SubmissionStatus;
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
  const visible = list.data.items;
  const counts = list.data.facets?.review_status ?? {};
  const total = tabs
    .filter((tab): tab is SubmissionStatus => tab !== "All")
    .reduce((sum, tab) => sum + (counts[tab] ?? 0), 0);
  const isReviewable = (row: SubmissionRow) =>
    row.pillarId !== null && reviewablePillarIds.includes(row.pillarId);

  async function decide(row: SubmissionRow, decision: Decision) {
    setBusy(true);
    setFeedback("");
    try {
      const result = await reviewSubmissionAction(row.id, decision);
      setFeedback(result.message);
      if (result.success) {
        setReviewing(null);
        setApproving(null);
        await list.refresh();
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
    visible.length > 0 &&
    (!exportablePillarIds ||
      visible.every((row) => row.pillarId !== null && exportablePillarIds.includes(row.pillarId)));
  const actions = exportable && (
    <ExportButton
      exportAction={() =>
        auditedExportAction({
          path: "/field-submissions",
          routeTemplate: "/field-submissions",
          query: {
            stage_event_status: active === "All" ? undefined : stageStatusOf[active],
            ...locationParams(list.query),
          },
        })
      }
    />
  );

  return (
    <div className="space-y-5">
      {heading && <PageHeading {...heading} />}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Submission status">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => list.filter({ status: tab === "All" ? undefined : tab })}
              aria-pressed={active === tab}
              className={`flex items-center gap-2 rounded-[10px] border px-4 py-[9px] text-sm font-semibold ${active === tab ? "border-[#F0CDBB] bg-creaw-orange-soft text-primary" : "border-creaw-line-strong bg-white text-creaw-body"}`}
            >
              {tab}{" "}
              <span className="rounded-full border border-creaw-line bg-white px-2 py-px text-xs text-creaw-body">
                {tab === "All" ? total : (counts[tab] ?? 0)}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <LocationFilter value={list.query} onChange={(location) => list.filter(location)} />
        </div>
        {actions && <div className="ml-auto">{actions}</div>}
      </div>
      <FormBanner tone="success">{feedback}</FormBanner>
      <FormBanner tone="error">{list.error}</FormBanner>
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
      {list.data.totalItems > list.data.pageSize && (
        <Pagination
          page={list.data.page}
          pageSize={list.data.pageSize as PageSize}
          totalItems={list.data.totalItems}
          onPageChange={(page) => list.filter({ page }, false)}
          onPageSizeChange={(pageSize) => list.filter({ pageSize })}
        />
      )}
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
