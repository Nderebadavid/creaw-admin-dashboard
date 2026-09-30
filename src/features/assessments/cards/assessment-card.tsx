import { initials, titleCase } from "@/lib/format";
import { CircleCheck, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssessmentView } from "../api";

/** Share of a score's maximum, clamped to 0–100 for bar widths. */
export const scorePercent = (score: number, max: number | null) =>
  Math.min(100, Math.max(0, max && max > 0 ? (score / max) * 100 : 0));

/** The design's traffic-light for a score: green from 70% of the maximum, amber from 56%. */
export const scoreColor = (score: number, max: number | null) => {
  const percent = scorePercent(score, max);
  return percent >= 70 ? "#1F7A4D" : percent >= 56 ? "#E0822F" : "#B8352C";
};

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
    <article className="flex flex-col gap-3.5 rounded-2xl border border-creaw-line bg-white p-[22px]">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-[11px] bg-[#F4ECE6] text-sm font-bold text-[#7A4A30]"
        >
          {initials(assessment.organisation)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15.5px] font-bold leading-snug">{assessment.organisation}</h3>
          <p className="text-[13px] text-creaw-faint">
            WRO partner · {titleCase(assessment.dueDiligence)}
          </p>
        </div>
        <div className="text-right">
          <strong className="font-heading text-[28px] leading-none">
            {assessment.score.toFixed(1)}
          </strong>
          <p className="text-[11.5px] text-creaw-faint">
            of {assessment.maxScore?.toFixed(1) ?? "—"}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {assessment.scores.map((score) => (
          <div
            key={score.label}
            className="grid grid-cols-[minmax(0,130px)_1fr_30px] items-center gap-2.5 text-[13px]"
          >
            <span className="truncate text-creaw-body">{score.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-[#F4EEE8]">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${scorePercent(score.score, score.max)}%`,
                  backgroundColor: scoreColor(score.score, score.max),
                }}
              />
            </span>
            <span className="text-right font-semibold">{score.score.toFixed(1)}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-creaw-divider pt-2.5">
        <div className="flex flex-col gap-0.5">
          <p
            className={`flex items-center gap-1.5 text-[13px] font-semibold ${complete ? "text-[#1F7A4D]" : "text-[#9A5A0E]"}`}
          >
            {complete ? (
              <CircleCheck size={17} aria-hidden="true" />
            ) : (
              <Hourglass size={17} aria-hidden="true" />
            )}
            Due diligence {obtained} of {assessment.documents.length}
          </p>
          {missing.length > 0 && (
            <p className="text-xs text-[#9A5A0E]">
              Missing: {missing.map((doc) => doc.name).join(", ")}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onOpen}>
          Open assessment
        </Button>
      </div>
    </article>
  );
}
