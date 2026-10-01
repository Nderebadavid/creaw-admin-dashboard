import { Check } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { SectionTitle } from "@/components/ui/record-parts";
import { formatDate } from "@/lib/format";
import type { CurriculumDetail, CurriculumSummary } from "../api";

/** "6 of 14 topics · 43%", or null when there is no curriculum to measure. */
export function curriculumLine(summary: CurriculumSummary) {
  if (summary.total === 0) return "No curriculum topics set up";
  const percent = Math.round((summary.done / summary.total) * 100);
  return `${summary.done} of ${summary.total} topics · ${percent}%`;
}

/**
 * One participant's SRHR curriculum: progress, each topic in order with the date last
 * attended, and the baseline / endline / graduation milestones. Progress comes from
 * attendance at the sessions staff already log, so there is nothing to enter here.
 */
export function CurriculumSection({
  summary,
  detail,
  loading,
  error,
}: {
  summary: CurriculumSummary;
  detail: CurriculumDetail | null;
  loading: boolean;
  error: string;
}) {
  const percent = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;
  return (
    <section aria-label="Curriculum" className="flex flex-col gap-2.5">
      <SectionTitle>Curriculum</SectionTitle>
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Curriculum progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-2 flex-1 overflow-hidden rounded-full bg-creaw-line"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-[13.5px] font-semibold">{curriculumLine(summary)}</span>
        {summary.behind && <StatusBadge tone="warning">Behind</StatusBadge>}
      </div>
      {error && <p className="text-[13.5px] text-creaw-faint">{error}</p>}
      {loading && <p className="text-[13.5px] text-creaw-faint">Loading topics…</p>}
      {detail && (
        <>
          <ul className="flex flex-col gap-1.5" aria-label="Curriculum topics">
            {detail.topics.map((topic) => (
              <li
                key={topic.id}
                className="flex items-center gap-2.5 rounded-lg border border-creaw-line bg-white px-3.5 py-2.5 text-[13.5px]"
              >
                <Check
                  size={15}
                  aria-hidden="true"
                  className={topic.attended ? "text-primary" : "text-creaw-line"}
                />
                <span className="flex-1 font-medium">
                  {topic.name}
                  <span className="ml-2 font-normal text-creaw-faint">{topic.type}</span>
                </span>
                <span className="text-creaw-faint">
                  {topic.attended ? `Attended ${formatDate(topic.attended)}` : "Not yet"}
                </span>
              </li>
            ))}
          </ul>
          {detail.milestones.length > 0 && (
            <dl className="grid grid-cols-3 gap-2.5" aria-label="Curriculum milestones">
              {detail.milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="rounded-lg border border-creaw-line bg-white px-3.5 py-2.5"
                >
                  <dt className="text-[12.5px] text-creaw-faint">{milestone.name}</dt>
                  <dd className="text-[13.5px] font-semibold">
                    {milestone.reachedAt ? formatDate(milestone.reachedAt) : "Not yet"}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </>
      )}
    </section>
  );
}
