import { initials } from "@/lib/format";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssessmentView } from "../api";

/** Share of a score's maximum, clamped to 0–100 for bar widths. */
export const scorePercent = (score: number, max: number | null) =>
  Math.min(100, Math.max(0, max && max > 0 ? (score / max) * 100 : 0));

/** One WRO partner: overall capacity score, per-dimension bars and due-diligence progress. */
export function AssessmentCard({
  assessment,
  onOpen,
}: {
  assessment: AssessmentView;
  onOpen: () => void;
}) {
  const obtained = assessment.documents.filter((doc) => doc.status === "obtained").length;
  const complete = obtained === assessment.documents.length;
  const missing = assessment.documents.filter((doc) => doc.status !== "obtained");

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-creaw-line bg-white p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#F3E9E2] text-sm font-bold text-[#9C6B4E]"
        >
          {initials(assessment.organisation)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug">{assessment.organisation}</h3>
          <p className="text-xs text-creaw-faint">
            WRO partner · {assessment.dueDiligence.replaceAll("_", " ")}
          </p>
        </div>
        <div className="text-right">
          <strong className="font-heading text-3xl">{assessment.score.toFixed(1)}</strong>
          <p className="text-xs text-creaw-faint">of {assessment.maxScore?.toFixed(1) ?? "—"}</p>
        </div>
      </div>
      <div className="space-y-2">
        {assessment.scores.map((score) => (
          <div
            key={score.label}
            className="grid grid-cols-[minmax(0,130px)_1fr_24px] items-center gap-2 text-xs"
          >
            <span className="truncate">{score.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-[#F4EEE8]">
              <span
                className="block h-full rounded-full bg-creaw-orange"
                style={{ width: `${scorePercent(score.score, score.max)}%` }}
              />
            </span>
            <span className="text-right font-semibold">{score.score}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto space-y-1 border-t border-creaw-divider pt-3 text-sm">
        <p
          className={`flex items-center gap-1.5 font-semibold ${complete ? "text-creaw-success" : "text-[#94570d]"}`}
        >
          {complete ? (
            <CircleCheck size={16} aria-hidden="true" />
          ) : (
            <CircleAlert size={16} aria-hidden="true" />
          )}
          Due diligence {obtained} of {assessment.documents.length} documents
        </p>
        {missing.slice(0, 2).map((doc) => (
          <p key={doc.id} className="text-xs text-[#94570d]">
            Missing: {doc.name}
          </p>
        ))}
        <Button variant="outline" className="mt-2" onClick={onOpen}>
          Open assessment
        </Button>
      </div>
    </article>
  );
}
