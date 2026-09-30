"use client";
import { usePagedList } from "@/components/data-table/use-paged-list";
import { FormBanner } from "@/components/ui/form-banner";
import { useState } from "react";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { PageHeading, type PageHeadingText } from "@/components/portal/page-heading";
import type { AssessmentPage, AssessmentView } from "./api";
import { listAssessmentsAction, viewAssessmentDocumentAction } from "./actions";
import { AssessmentCard } from "./cards/assessment-card";
import { AssessmentDrawer } from "./cards/assessment-drawer";
import { AttachDocumentDialog, RecommendationDialog } from "./cards/assessment-dialogs";

type Modal = "recommend" | "approve" | "attach" | null;

/**
 * WRO partner capacity assessments as cards. Each opens a drawer with the
 * score breakdown, the recommendation workflow and the due-diligence checklist.
 */
export function AssessmentsContent({
  heading,
  initial,
  canRecommend,
  canApprove,
  canAttach,
  canDownload = false,
}: {
  heading?: PageHeadingText;
  initial: AssessmentPage;
  canRecommend: boolean;
  canApprove: boolean;
  canAttach: boolean;
  canDownload?: boolean;
}) {
  const list = usePagedList<AssessmentView, { page?: number; pageSize?: number }>(
    initial,
    { page: 1, pageSize: 25 },
    (query) => listAssessmentsAction(query.page ?? 1, query.pageSize ?? 25)
  );
  const data = list.data;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [checkId, setCheckId] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const error = actionError || list.error;
  const [feedback, setFeedback] = useState("");
  // Look the selection up in the latest page so the drawer shows fresh data after a save.
  const selected: AssessmentView | null = data.items.find((item) => item.id === selectedId) ?? null;

  const done = (message: string) => {
    setModal(null);
    setCheckId(null);
    setFeedback(message);
    void list.refresh();
  };

  async function viewDocument(documentId: number) {
    if (!selected) return;
    const response = await viewAssessmentDocumentAction(selected.id, documentId);
    if (response.success) setFeedback("Document access audited. Mock mode provides metadata only.");
    else setActionError(response.message);
  }

  return (
    <div className="space-y-5">
      {heading && <PageHeading {...heading} />}
      <FormBanner tone="success">{feedback}</FormBanner>
      <FormBanner tone="error">{error}</FormBanner>
      {list.loading && <p role="status">Loading assessments…</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.items.map((item) => (
          <AssessmentCard key={item.id} assessment={item} onOpen={() => setSelectedId(item.id)} />
        ))}
      </div>
      {!list.loading && !data.items.length && (
        <p className="rounded-2xl border bg-white p-8 text-center text-sm text-creaw-faint">
          No assessments available.
        </p>
      )}
      <Pagination
        page={data.page}
        pageSize={data.pageSize as PageSize}
        totalItems={data.totalItems}
        onPageChange={(page) => list.filter({ page }, false)}
        onPageSizeChange={(pageSize) => list.filter({ pageSize })}
      />
      <AssessmentDrawer
        assessment={modal === null && checkId === null ? selected : null}
        canRecommend={canRecommend}
        canApprove={canApprove}
        canAttach={canAttach}
        canDownload={canDownload}
        onClose={() => setSelectedId(null)}
        onRecommend={() => setModal("recommend")}
        onApprove={() => setModal("approve")}
        onAttach={setCheckId}
        onView={(documentId) => void viewDocument(documentId)}
      />
      <RecommendationDialog
        assessment={modal === "recommend" || modal === "approve" ? selected : null}
        approve={modal === "approve"}
        onClose={() => setModal(null)}
        onDone={done}
      />
      <AttachDocumentDialog
        checkId={checkId}
        checkName={selected?.documents.find((doc) => doc.id === checkId)?.name}
        onClose={() => setCheckId(null)}
        onDone={done}
      />
    </div>
  );
}
