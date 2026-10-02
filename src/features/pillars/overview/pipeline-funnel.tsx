import type { ReactNode } from "react";

const card = "rounded-2xl border border-creaw-line bg-white p-6";

/**
 * Stage-by-stage progression through a pillar's pipeline. Each bar is the
 * stage's count as a share of the entry stage, so drop-off reads top to bottom.
 */
export function PipelineFunnel({
  title,
  subtitle,
  color,
  stages,
  emptyMessage,
  actions,
}: {
  title: string;
  subtitle: string;
  color: string;
  stages: readonly { name: string; count: number }[];
  /** Shown in place of the bars when there are no stage counts. */
  emptyMessage: string;
  /** Controls beside the heading, e.g. a pillar picker. */
  actions?: ReactNode;
}) {
  const entry = Math.max(1, stages[0]?.count ?? 0);
  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-[22px] font-bold">{title}</h2>
          <p className="mt-0.5 text-[13.5px] text-creaw-faint">{subtitle}</p>
        </div>
        {actions}
      </div>
      {stages.length ? (
        <ol className="mt-3.5 flex flex-col gap-3.5">
          {stages.map((stage) => {
            const percent = Math.round((stage.count / entry) * 100);
            return (
              <li key={stage.name}>
                <div className="mb-1.5 flex justify-between gap-3 text-sm">
                  <span className="font-medium text-creaw-ink-soft">{stage.name}</span>
                  <span className="tabular-nums">
                    <strong className="font-semibold">{stage.count.toLocaleString()}</strong>
                    <span className="font-medium text-[#A39A92]"> · {percent}%</span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#F4EEE8]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${percent}%`, backgroundColor: color }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-creaw-faint">{emptyMessage}</p>
      )}
    </section>
  );
}
