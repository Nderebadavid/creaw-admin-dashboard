"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import type { AssessmentPage, AssessmentView } from "./api";
import {
  approveAssessmentAction,
  attachAssessmentDocumentAction,
  listAssessmentsAction,
  recommendAssessmentAction,
  viewAssessmentDocumentAction,
} from "./actions";

export function AssessmentsContent({
  initial,
  canRecommend,
  canApprove,
  canAttach,
  canDownload = false,
}: {
  initial: AssessmentPage;
  canRecommend: boolean;
  canApprove: boolean;
  canAttach: boolean;
  canDownload?: boolean;
}) {
  const [data, setData] = useState(initial),
    [selected, setSelected] = useState<AssessmentView | null>(null),
    [modal, setModal] = useState<"detail" | "recommend" | "approve" | "attach" | null>(null);
  const [checkId, setCheckId] = useState<number | null>(null),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState("");
  async function changePage(page: number, pageSize: number) {
    setLoading(true);
    const response = await listAssessmentsAction(page, pageSize);
    if (response.success && response.data) {
      setData(response.data);
      setError("");
    } else setError(response.message);
    setLoading(false);
  }
  async function saveRecommendation(event: FormEvent<HTMLFormElement>, approve: boolean) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const input = { id: selected.id, recommendation: String(form.get("recommendation") ?? "") };
    const response = approve
      ? await approveAssessmentAction(input)
      : await recommendAssessmentAction(input);
    setBusy(false);
    if (response.success) {
      setFeedback(approve ? "Recommendation approved." : "Recommendation recorded for review.");
      setModal(null);
      void changePage(data.page, data.pageSize);
    } else setError(response.message);
  }
  async function attach(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!checkId) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const response = await attachAssessmentDocumentAction({
      checkId,
      fileUrl: String(form.get("fileUrl") ?? ""),
    });
    setBusy(false);
    if (response.success) {
      setFeedback("Document attached to the assessment check.");
      setModal(null);
      void changePage(data.page, data.pageSize);
    } else setError(response.message);
  }
  async function viewDocument(id: number) {
    if (!selected) return;
    const response = await viewAssessmentDocumentAction(selected.id, id);
    if (response.success) setFeedback("Document access audited. Mock mode provides metadata only.");
    else setError(response.message);
  }
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading text-xl font-bold">Organisation capacity assessments</h2>
        <p className="text-sm text-creaw-muted">
          WRO capacity scoring, due diligence and document checks
        </p>
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
      {loading && <p role="status">Loading assessments…</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.items.map((item) => (
          <article key={item.id} className="flex flex-col gap-4 rounded-2xl border bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{item.organisation}</h3>
                <p className="text-xs text-creaw-muted">
                  WRO partner · {item.dueDiligence.replaceAll("_", " ")}
                </p>
              </div>
              <div className="text-right">
                <strong className="font-heading text-3xl">{item.score.toFixed(1)}</strong>
                <p className="text-xs text-creaw-muted">of {item.maxScore?.toFixed(1) ?? "—"}</p>
              </div>
            </div>
            <div className="space-y-2">
              {item.scores.map((score) => (
                <div
                  key={score.label}
                  className="grid grid-cols-[minmax(0,130px)_1fr_24px] items-center gap-2 text-xs"
                >
                  <span className="truncate">{score.label}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-[#F4EEE8]">
                    <span
                      className="block h-full rounded-full bg-creaw-orange"
                      style={{
                        width: `${Math.min(100, Math.max(0, score.max && score.max > 0 ? (score.score / score.max) * 100 : 0))}%`,
                      }}
                    />
                  </span>
                  <span className="text-right font-semibold">{score.score}</span>
                </div>
              ))}
            </div>
            <div className="mt-auto border-t pt-3 text-sm">
              <p className="font-semibold">
                Due diligence: {item.documents.filter((doc) => doc.status === "obtained").length} of{" "}
                {item.documents.length} documents
              </p>
              {item.documents
                .filter((doc) => doc.status !== "obtained")
                .slice(0, 2)
                .map((doc) => (
                  <p key={doc.id} className="mt-1 text-xs text-[#94570d]">
                    Missing: {doc.name}
                  </p>
                ))}
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => {
                  setSelected(item);
                  setModal("detail");
                  setError("");
                }}
              >
                Open assessment
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!loading && !data.items.length && (
        <p className="rounded-2xl border bg-white p-8 text-center text-sm text-creaw-muted">
          No assessments available.
        </p>
      )}
      <Pagination
        page={data.page}
        pageSize={data.pageSize as PageSize}
        totalItems={data.totalItems}
        onPageChange={(page) => void changePage(page, data.pageSize)}
        onPageSizeChange={(pageSize) => void changePage(1, pageSize)}
      />
      <Dialog
        open={modal === "detail"}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle>{selected?.organisation}</DialogTitle>
          <DialogDescription>
            Capacity assessment and due diligence · score {selected?.score.toFixed(1)} of{" "}
            {selected?.maxScore ?? "—"}
          </DialogDescription>
          {selected && (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {selected.scores.map((score) => (
                  <div key={score.label} className="rounded-xl border p-3 text-sm">
                    <span>{score.label}</span>
                    <strong className="float-right">
                      {score.score} / {score.max ?? "Not set"}
                    </strong>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold">Document checklist</h3>
                <ul className="mt-2 space-y-2">
                  {selected.documents.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"
                    >
                      <span>
                        {doc.name}
                        <span className="ml-2 text-xs text-creaw-muted">
                          {doc.status === "obtained" ? "Received" : "Missing"}
                        </span>
                      </span>
                      {doc.status !== "obtained" ? (
                        <Button
                          size="sm"
                          disabled={!canAttach}
                          title={
                            !canAttach ? "Due diligence and upload permissions required" : undefined
                          }
                          onClick={() => {
                            setCheckId(doc.id);
                            setModal("attach");
                          }}
                        >
                          Attach
                        </Button>
                      ) : (
                        doc.documentId && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canDownload}
                            onClick={() => void viewDocument(doc.documentId!)}
                          >
                            View
                          </Button>
                        )
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-sm">
                Proposed recommendation: {selected.proposedRecommendation ?? "Not recorded"}
                <br />
                Approved recommendation: {selected.recommendation ?? "Pending approval"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!canRecommend}
                  onClick={() => setModal("recommend")}
                >
                  Record recommendation
                </Button>
                <Button
                  disabled={!canApprove}
                  title={!canApprove ? "Approval permission required" : undefined}
                  onClick={() => setModal("approve")}
                >
                  Approve recommendation
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={modal === "recommend" || modal === "approve"}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setModal(null);
            setError("");
          }
        }}
      >
        <DialogContent>
          <DialogTitle>
            {modal === "approve" ? "Approve recommendation" : "Record recommendation"}
          </DialogTitle>
          <DialogDescription>
            {selected?.organisation} · capacity score {selected?.score.toFixed(1)} / 5
          </DialogDescription>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <form
            className="space-y-3"
            onSubmit={(event) => saveRecommendation(event, modal === "approve")}
          >
            <label className="block text-sm">
              Recommendation
              <select
                name="recommendation"
                defaultValue={selected?.proposedRecommendation ?? ""}
                required
                className="mt-1 w-full rounded-lg border p-2"
              >
                <option value="">Select recommendation</option>
                <option value="award">Proceed to sub-grant</option>
                <option value="capacity_support">Proceed with capacity support</option>
                <option value="defer">Defer and reassess</option>
                <option value="decline">Do not proceed</option>
              </select>
            </label>
            <Button type="submit" disabled={busy}>
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={modal === "attach"}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setModal(null);
            setError("");
          }
        }}
      >
        <DialogContent>
          <DialogTitle>Attach due diligence document</DialogTitle>
          <DialogDescription>
            {selected?.documents.find((doc) => doc.id === checkId)?.name}
          </DialogDescription>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <form className="space-y-3" onSubmit={attach}>
            <label className="block text-sm">
              Document URL
              <input
                name="fileUrl"
                type="url"
                required
                placeholder="https://…"
                className="mt-1 w-full rounded-lg border p-2"
              />
            </label>
            <p className="text-xs text-creaw-muted">Mock mode stores document metadata only.</p>
            <Button type="submit" disabled={busy}>
              Attach document
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
