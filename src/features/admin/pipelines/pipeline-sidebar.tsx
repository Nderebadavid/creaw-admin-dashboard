import { isPillarShown } from "@/components/portal/pillars";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PipelineRecord, PipelinePillar } from "./types";
import { pillarColor } from "./types";

/** Stage totals per pillar, plus a prompt to create Leadership's pipeline when it has none. */
export function PipelineSidebar({
  pillars,
  pipelines,
  onCreateLeadership,
}: {
  pillars: PipelinePillar[];
  pipelines: PipelineRecord[];
  onCreateLeadership: (pillarId: number) => void;
}) {
  const stageCount = (pillarId: number) =>
    pipelines.find((row) => row.pillar_id === pillarId)?.stages.length ?? 0;
  // Hidden from the portal for now; the prompt returns when the pillar does.
  const leadership = pillars.find(
    (row) =>
      row.code.toLowerCase() === "leadership" &&
      isPillarShown("leadership") &&
      !pipelines.some((pipe) => pipe.pillar_id === row.id)
  );

  return (
    <aside className="min-w-64 flex-[1_1_280px] space-y-4">
      <div className="rounded-2xl border border-creaw-line bg-white p-5">
        <h2 className="font-heading text-xl font-bold">Stage counts by pillar</h2>
        <dl className="mt-3 space-y-3">
          {pillars.map((pillar) => (
            <div key={pillar.id} className="flex items-center gap-3 text-sm">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: pillarColor(pillar.code) }}
              />
              <dt className="flex-1">{pillar.name}</dt>
              <dd className="font-bold">{stageCount(pillar.id)}</dd>
            </div>
          ))}
        </dl>
      </div>
      {leadership && (
        <div className="rounded-2xl border border-dashed border-creaw-line bg-white p-5">
          <h2 className="font-heading text-xl font-bold">Leadership</h2>
          <p className="mt-2 text-sm text-creaw-body">
            Has a pillar row but no pipeline_definition yet, so participants cannot be staged in it.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => onCreateLeadership(leadership.id)}
          >
            <Plus />
            Create pipeline
          </Button>
        </div>
      )}
    </aside>
  );
}
