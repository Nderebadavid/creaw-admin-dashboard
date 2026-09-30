import type { PillarView } from "../api";

const card = "rounded-2xl border border-creaw-line bg-white p-6";

/**
 * Stage-by-stage progression through the pillar's pipeline. Each bar is the
 * stage's count as a share of the entry stage, so drop-off reads left to right.
 */
export function PipelineFunnel({ pillar }: { pillar: PillarView }) {
  const stages = pillar.stageCounts ?? [];
  const entry = Math.max(1, stages[0]?.count ?? 0);
  return (
    <section className={card}>
      <h2 className="font-heading text-[22px] font-bold">{pillar.name} pipeline</h2>
      <p className="mt-0.5 text-[13.5px] text-creaw-faint">Participant progression this year</p>
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
                    style={{ width: `${percent}%`, backgroundColor: pillar.color }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-creaw-faint">
          {pillar.stages.length
            ? "Stage counts unavailable for this role."
            : "No stages configured yet."}
        </p>
      )}
    </section>
  );
}
