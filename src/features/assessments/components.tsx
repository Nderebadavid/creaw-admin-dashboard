"use client";
import { useState } from "react";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { PageHeading } from "@/components/portal/page-heading";
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
  heading?: { title: string; section: string; description: string };
  initial: AssessmentPage;
  canRecommend: boolean;
  canApprove: boolean;
  canAttach: boolean;
  canDownload?: boolean;
}) {
  const [data, setData] = useState(initial);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [checkId, setCheckId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  // Look the selection up in the latest page so the drawer shows fresh data after a save.
  const selected: AssessmentView | null = data.items.find((item) => item.id === selectedId) ?? null;

  async function load(page: number, pageSize: number) {
    setLoading(true);
    const response = await listAssessmentsAction(page, pageSize);
    if (response.success && response.data) {
      setData(response.data);
      setError("");
    } else setError(response.message);
    setLoading(false);
  }

  const done = (message: string) => {
    setModal(null);
    setCheckId(null);
    setFeedback(message);
    void load(data.page, data.pageSize);
  };

  async function viewDocument(documentId: number) {
    if (!selected) return;
    const response = await viewAssessmentDocumentAction(selected.id, documentId);
    if (response.success) setFeedback("Document access audited. Mock mode provides metadata only.");
    else setError(response.message);
  }

  return (
    <div className="space-y-5">
      {heading && <PageHeading {...heading} />}
      {feedback && (
        <p
          role="status"
          className="rounded-xl bg-creaw-success-soft p-3 text-sm text-creaw-success"
        >
          {feedback}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-creaw-danger-soft p-3 text-sm text-creaw-danger">
          {error}
        </p>
      )}
      {loading && <p role="status">Loading assessments…</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.items.map((item) => (
          <AssessmentCard key={item.id} assessment={item} onOpen={() => setSelectedId(item.id)} />
        ))}
      </div>
      {!loading && !data.items.length && (
        <p className="rounded-2xl border bg-white p-8 text-center text-sm text-creaw-faint">
          No assessments available.
        </p>
      )}
      <Pagination
        page={data.page}
        pageSize={data.pageSize as PageSize}
        totalItems={data.totalItems}
        onPageChange={(page) => void load(page, data.pageSize)}
        onPageSizeChange={(pageSize) => void load(1, pageSize)}
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
