"use client";
import { initials } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { RecordDrawer } from "@/components/ui/record-drawer";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AssessmentView } from "../api";
import { scorePercent } from "./assessment-card";

/** Labels for assessment.overall_recommendation values. */
export const recommendationLabels: Record<string, string> = {
  award: "Proceed to sub-grant",
  capacity_support: "Proceed with capacity support",
  defer: "Defer and reassess",
  decline: "Do not proceed",
};
const labelOf = (value: string | null, fallback: string) =>
  value ? (recommendationLabels[value] ?? value) : fallback;

/** An organisation's capacity assessment, recommendation workflow and due-diligence documents. */
export function AssessmentDrawer({
  assessment,
  canRecommend,
  canApprove,
  canAttach,
  canDownload,
  onClose,
  onRecommend,
  onApprove,
  onAttach,
  onView,
}: {
  assessment: AssessmentView | null;
  canRecommend: boolean;
  canApprove: boolean;
  canAttach: boolean;
  canDownload: boolean;
  onClose: () => void;
  onRecommend: () => void;
  onApprove: () => void;
  onAttach: (checkId: number) => void;
  onView: (documentId: number) => void;
}) {
  if (!assessment) return null;
  return (
    <RecordDrawer
      open
      onClose={onClose}
      initials={initials(assessment.organisation)}
      kind="Organisation · WROs"
      title={assessment.organisation}
      subtitle={`Due diligence ${assessment.dueDiligence.replaceAll("_", " ")}`}
      accent="#9C6B4E"
      tint="#F3E9E2"
      status={
        <StatusBadge tone={assessment.recommendation ? "success" : "warning"}>
          {assessment.recommendation ? "Recommendation approved" : "Awaiting approval"}
        </StatusBadge>
      }
      actions={
        <>
          <Button variant="outline" size="sm" disabled={!canRecommend} onClick={onRecommend}>
            Record recommendation
          </Button>
          <Button
            size="sm"
            disabled={!canApprove}
            title={!canApprove ? "Approval permission required" : undefined}
            onClick={onApprove}
          >
            Approve recommendation
          </Button>
        </>
      }
      tabs={[
        {
          id: "overview",
          label: "Overview",
          content: (
            <div className="space-y-6">
              <section>
                <div className="flex items-baseline justify-between">
                  <h3 className="font-heading text-lg font-bold">Capacity assessment</h3>
                  <span className="font-heading text-xl font-bold">
                    {assessment.score.toFixed(1)} / {assessment.maxScore ?? "—"}
                  </span>
                </div>
                <ul className="mt-3 space-y-2.5">
                  {assessment.scores.map((score) => (
                    <li key={score.label} className="text-sm">
                      <div className="mb-1 flex justify-between">
                        <span>{score.label}</span>
                        <strong>
                          {score.score} / {score.max ?? "Not set"}
                        </strong>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#F4EEE8]">
                        <div
                          className="h-full rounded-full bg-creaw-orange"
                          style={{ width: `${scorePercent(score.score, score.max)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-creaw-faint">
                    Proposed recommendation
                  </dt>
                  <dd className="mt-1">
                    {labelOf(assessment.proposedRecommendation, "Not recorded")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-creaw-faint">
                    Approved recommendation
                  </dt>
                  <dd className="mt-1">{labelOf(assessment.recommendation, "Pending approval")}</dd>
                </div>
              </dl>
            </div>
          ),
        },
        {
          id: "documents",
          label: "Documents",
          content: (
            <ul className="space-y-2">
              {assessment.documents.map((doc) => {
                const received = doc.status === "obtained";
                return (
                  <li
                    key={doc.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 ${received ? "border-creaw-line" : "border-dashed border-[#E6B069] bg-[#FFFBF7]"}`}
                  >
                    <span>
                      <span className="font-semibold">{doc.name}</span>
                      <span className="block text-xs text-creaw-faint">
                        {received ? "Received" : "Missing — required for due diligence"}
                      </span>
                    </span>
                    {!received ? (
                      <Button
                        size="sm"
                        disabled={!canAttach}
                        title={
                          !canAttach ? "Due diligence and upload permissions required" : undefined
                        }
                        aria-label={`Attach ${doc.name}`}
                        onClick={() => onAttach(doc.id)}
                      >
                        Attach
                      </Button>
                    ) : (
                      doc.documentId && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canDownload}
                          aria-label={`View ${doc.name}`}
                          onClick={() => onView(doc.documentId!)}
                        >
                          View
                        </Button>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          ),
        },
      ]}
    />
  );
}
