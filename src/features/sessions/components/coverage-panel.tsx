"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Circle, CircleCheck } from "lucide-react";
import { formatDate } from "@/lib/format";
import { periodLabels, sessionPeriods, type SessionWorkspace } from "../model";

const topicButton =
  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-creaw-line/40";
/** A topic picked in the panel; names can repeat across activity types. */
export interface TopicFilter {
  activityTypeId: number;
  topic: string;
}
const plural = (count: number) => `${count} ${count === 1 ? "session" : "sessions"}`;

/** Planned topics per activity type, marked covered or not in the chosen period. */
export function CoveragePanel({
  workspace,
  onTopic,
}: {
  workspace: SessionWorkspace;
  onTopic: (filter: TopicFilter) => void;
}) {
  const pathname = usePathname();
  return (
    <section
      aria-labelledby="coverage-title"
      className="flex flex-col gap-4 rounded-2xl border border-creaw-line bg-white p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="coverage-title" className="text-lg font-semibold">
          Curriculum coverage
        </h2>
        <nav aria-label="Coverage period" className="flex gap-2">
          {sessionPeriods.map((period) => (
            <Link
              key={period}
              href={`${pathname}?period=${period}`}
              aria-current={workspace.period === period ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${
                workspace.period === period
                  ? "border-creaw-ink bg-creaw-ink text-white"
                  : "border-creaw-line-strong bg-white text-creaw-body"
              }`}
            >
              {periodLabels[period]}
            </Link>
          ))}
        </nav>
      </div>
      {workspace.coverage.map((type) => {
        const covered = type.topics.filter((topic) => topic.sessions > 0).length;
        return (
          <details key={type.activityTypeId} open className="rounded-xl border border-creaw-line p-4">
            <summary className="flex cursor-pointer items-center justify-between font-semibold">
              <span>{type.name}</span>
              <span className="text-[13px] font-medium text-creaw-faint">
                {covered}/{type.topics.length}
              </span>
            </summary>
            {type.topics.length === 0 ? (
              <div className="mt-3 text-sm text-creaw-faint">
                <p className="font-semibold text-creaw-ink-soft">No planned topics yet</p>
                <p>Add them in Admin → Lookups → Activity topics.</p>
              </div>
            ) : (
              <ol className="mt-3 flex flex-col gap-1">
                {type.topics.map((topic) => (
                  <li key={topic.topicId}>
                    <button
                      type="button"
                      aria-label={`Show sessions on ${topic.name}`}
                      onClick={() => onTopic({ activityTypeId: type.activityTypeId, topic: topic.name })}
                      className={topicButton}
                    >
                      {topic.sessions > 0 ? (
                        <CircleCheck size={16} aria-hidden="true" className="shrink-0 text-creaw-success" />
                      ) : (
                        <Circle size={16} aria-hidden="true" className="shrink-0 text-creaw-faint" />
                      )}
                      <span className="font-medium">{topic.name}</span>
                      <span className="ml-auto text-[13px] text-creaw-faint">
                        {topic.sessions > 0
                          ? `${topic.lastDelivered ? `${formatDate(topic.lastDelivered)} · ` : ""}${plural(topic.sessions)}`
                          : "Not yet covered"}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
            {type.otherTopics.length > 0 && (
              <div className="mt-3">
                <h3 className="text-[13px] font-semibold uppercase text-creaw-faint">Other topics</h3>
                <ul className="mt-1 flex flex-col gap-1">
                  {type.otherTopics.map((topic) => (
                    <li key={topic.name}>
                      <button
                        type="button"
                        aria-label={`Show sessions on ${topic.name}`}
                        onClick={() => onTopic({ activityTypeId: type.activityTypeId, topic: topic.name })}
                        className={topicButton}
                      >
                        <span className="font-medium">{topic.name}</span>
                        <span className="ml-auto text-[13px] text-creaw-faint">{plural(topic.sessions)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </details>
        );
      })}
    </section>
  );
}
