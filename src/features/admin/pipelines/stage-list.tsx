import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StageView } from "../api";

const tag = "ml-2 rounded-md bg-creaw-canvas px-2 py-1 text-xs text-creaw-faint";

/** Ordered stages with move, rename and remove controls; the ends are tagged Entry/Exit. */
export function StageList({
  stages,
  onMove,
  onRename,
  onRemove,
}: {
  stages: StageView[];
  onMove: (stage: StageView, direction: "up" | "down") => void;
  onRename: (stage: StageView) => void;
  onRemove: (stage: StageView) => void;
}) {
  const last = stages.length - 1;
  return (
    <>
      <ol className="divide-y divide-[#F7F2EC]">
        {stages.map((stage, index) => (
          <li key={stage.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-creaw-orange-soft text-sm font-bold text-creaw-orange">
              {index + 1}
            </span>
            <div className="min-w-36 flex-1">
              <span className="font-semibold">{stage.name}</span>
              {index === 0 && <span className={tag}>Entry stage</span>}
              {index === last && <span className={tag}>Exit stage</span>}
            </div>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="outline"
                aria-label={`Move ${stage.name} up`}
                disabled={index === 0}
                onClick={() => onMove(stage, "up")}
              >
                <ArrowUp />
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label={`Move ${stage.name} down`}
                disabled={index === last}
                onClick={() => onMove(stage, "down")}
              >
                <ArrowDown />
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label={`Rename ${stage.name}`}
                onClick={() => onRename(stage)}
              >
                <Pencil />
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label={`Remove ${stage.name}`}
                // A pipeline needs at least one stage.
                disabled={stages.length <= 1}
                onClick={() => onRemove(stage)}
              >
                <Trash2 className="text-creaw-danger" />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <p className="p-5 text-xs text-creaw-faint">
        Reordering updates stage_definition.step_no. Existing participant events retain their stage
        references and audit history.
      </p>
    </>
  );
}
