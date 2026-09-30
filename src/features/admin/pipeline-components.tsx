"use client";
import { pillarLookBySlug } from "@/components/portal/pillars";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { History, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/ui/form-banner";
import { PipelineSidebar } from "./pipelines/pipeline-sidebar";
import { StageConfirmDialog, StageFormDialog } from "./pipelines/stage-dialogs";
import { StageList } from "./pipelines/stage-list";
import {
  pillarColor,
  type PipelinePillar,
  type PipelineRecord,
  type StageModal,
} from "./pipelines/types";

export type { PipelineRecord };

/**
 * Pipeline & stage configuration: one tab per pillar showing its ordered
 * stages. Every change goes through a confirming dialog and refreshes the route.
 */
export function PipelineContent({
  pillars,
  pipelines,
  canViewAudit = false,
}: {
  pillars: PipelinePillar[];
  pipelines: PipelineRecord[];
  canViewAudit?: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(pillars[0]?.id ?? 0);
  const [modal, setModal] = useState<StageModal | null>(null);
  const [feedback, setFeedback] = useState("");
  const selected = pillars.find((row) => row.id === selectedId) ?? pillars[0];
  const pipelineOf = (pillarId: number | undefined) =>
    pipelines.find((row) => row.pillar_id === pillarId);
  const pipeline = pipelineOf(selected?.id);
  const stages = pipeline?.stages ?? [];

  const close = () => setModal(null);
  const done = (message: string) => {
    setModal(null);
    setFeedback(message);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Pillar pipelines" className="flex flex-wrap gap-2">
        {pillars.map((pillar) => (
          <button
            key={pillar.id}
            type="button"
            role="tab"
            aria-selected={selected?.id === pillar.id}
            onClick={() => setSelectedId(pillar.id)}
            className="flex items-center gap-2 rounded-[10px] border border-creaw-line-strong bg-white px-4 py-[9px] text-sm font-semibold text-creaw-body"
            style={
              selected?.id === pillar.id
                ? {
                    backgroundColor: pillarLookBySlug(pillar.code)?.tint,
                    color: pillarColor(pillar.code),
                    borderColor: pillarColor(pillar.code),
                  }
                : undefined
            }
          >
            <span
              className="size-[9px] rounded-full"
              style={{ backgroundColor: pillarColor(pillar.code) }}
            />
            {pillarLookBySlug(pillar.code)?.name ?? pillar.name}
            <span className="text-xs font-medium text-creaw-faint">
              {pipelineOf(pillar.id)?.stages.length ?? 0}
            </span>
          </button>
        ))}
      </div>
      <FormBanner tone="success">{feedback}</FormBanner>
      <div className="flex flex-wrap items-start gap-5">
        <section className="min-w-0 flex-[2_1_520px] rounded-2xl border border-creaw-line bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-creaw-divider p-5">
            <div>
              <h2 className="font-heading text-2xl font-bold">{selected?.name} pathway</h2>
              <p className="text-sm text-creaw-faint">
                {pipeline
                  ? `pipeline_definition v${pipeline.version} · ${stages.length} stages`
                  : "No pipeline definition yet"}
              </p>
            </div>
            {pipeline && (
              <Button onClick={() => setModal({ kind: "add" })}>
                <Plus />
                Add stage
              </Button>
            )}
          </div>
          {pipeline ? (
            <StageList
              stages={stages}
              onMove={(stage, direction) => setModal({ kind: "move", stage, direction })}
              onRename={(stage) => setModal({ kind: "rename", stage })}
              onRemove={(stage) => setModal({ kind: "remove", stage })}
            />
          ) : (
            <div className="p-8">
              <h3 className="font-heading text-xl font-bold">
                {selected?.name} has no pipeline yet
              </h3>
              <p className="mt-2 max-w-lg text-sm text-creaw-body">
                Create a pathway before participants can be staged here.
              </p>
              <Button className="mt-4" onClick={() => setModal({ kind: "create" })}>
                <Plus />
                Create pipeline
              </Button>
            </div>
          )}
        </section>
        <PipelineSidebar
          pillars={pillars}
          pipelines={pipelines}
          onCreateLeadership={(pillarId) => {
            setSelectedId(pillarId);
            setModal({ kind: "create" });
          }}
        />
      </div>
      {canViewAudit && (
        <Link
          href="/audit?module=stage_definition"
          className="inline-flex items-center gap-2 text-sm font-semibold text-creaw-orange hover:underline"
        >
          <History size={16} />
          View stage history
        </Link>
      )}
      <StageFormDialog
        modal={modal}
        pillar={selected}
        pipeline={pipeline}
        stages={stages}
        onClose={close}
        onDone={done}
      />
      <StageConfirmDialog modal={modal} pillarName={selected?.name} onClose={close} onDone={done} />
    </div>
  );
}
