"use client";
import { useState, type FormEvent } from "react";
import { fieldClass } from "./form-styles";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowUp, History, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { PipelineView, StageView } from "./api";
import {
  addStageAction,
  createPipelineAction,
  moveStageAction,
  removeStageAction,
  renameStageAction,
} from "./pipeline-actions";

type Pillar = { id: number; code: string; name: string };
export type PipelineRecord = PipelineView & { stages: StageView[] };
const colors: Record<string, string> = {
  VAWG: "#C04F53",
  WEE: "#DB8A45",
  SRHR: "#58A891",
  LEADERSHIP: "#9D83BB",
  WRO: "#7198BE",
  SKILLING: "#DEB859",
};
export function PipelineContent({
  pillars,
  pipelines,
  canViewAudit = false,
}: {
  pillars: Pillar[];
  pipelines: PipelineRecord[];
  canViewAudit?: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(pillars[0]?.id ?? 0);
  const [modal, setModal] = useState<"add" | "rename" | "move" | "remove" | "create" | null>(null);
  const [target, setTarget] = useState<StageView | null>(null);
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState("");
  const selected = pillars.find((row) => row.id === selectedId) ?? pillars[0];
  const pipeline = pipelines.find((row) => row.pillar_id === selected?.id);
  const stages = pipeline?.stages ?? [];
  const open = (kind: typeof modal, stage?: StageView, moveDirection?: "up" | "down") => {
    setError("");
    setTarget(stage ?? null);
    if (moveDirection) setDirection(moveDirection);
    setModal(kind);
  };
  async function execute(promise: Promise<{ success: boolean; message: string }>, message: string) {
    setBusy(true);
    setError("");
    try {
      const response = await promise;
      if (response.success) {
        setFeedback(message);
        setModal(null);
        router.refresh();
      } else setError(response.message);
    } catch {
      setError("Could not save this change. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    if (modal === "create")
      void execute(
        createPipelineAction({
          pillarId: selected.id,
          name: String(form.get("name")),
          firstStage: String(form.get("firstStage")),
          lastStage: String(form.get("lastStage")),
        }),
        "Pipeline created."
      );
    if (modal === "add" && pipeline)
      void execute(
        addStageAction({
          pipelineId: pipeline.id,
          name: String(form.get("name")),
          position: Number(form.get("position")),
        }),
        "Stage added."
      );
    if (modal === "rename" && target)
      void execute(
        renameStageAction({ stageId: target.id, name: String(form.get("name")) }),
        "Stage renamed."
      );
  }
  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Pillar pipelines" className="flex flex-wrap gap-2">
        {pillars.map((pillar) => {
          const count = pipelines.find((row) => row.pillar_id === pillar.id)?.stages.length ?? 0;
          return (
            <button
              key={pillar.id}
              type="button"
              role="tab"
              aria-selected={selected?.id === pillar.id}
              onClick={() => setSelectedId(pillar.id)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${selected?.id === pillar.id ? "border-creaw-orange bg-creaw-orange-soft text-creaw-orange" : "border-creaw-line-strong bg-white text-creaw-body"}`}
            >
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: colors[pillar.code] ?? "#B4552E" }}
              />
              {pillar.name}
              <span className="text-xs opacity-70">{count}</span>
            </button>
          );
        })}
      </div>
      {feedback && (
        <p
          role="status"
          className="rounded-lg bg-creaw-success-soft p-3 text-sm text-creaw-success"
        >
          {feedback}
        </p>
      )}
      {error && !modal && (
        <p role="alert" className="rounded-lg bg-creaw-danger-soft p-3 text-sm text-creaw-danger">
          {error}
        </p>
      )}
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
              <Button onClick={() => open("add")}>
                <Plus />
                Add stage
              </Button>
            )}
          </div>
          {pipeline ? (
            <>
              <ol className="divide-y divide-[#F7F2EC]">
                {stages.map((stage, index) => (
                  <li key={stage.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-creaw-orange-soft text-sm font-bold text-creaw-orange">
                      {index + 1}
                    </span>
                    <div className="min-w-36 flex-1">
                      <span className="font-semibold">{stage.name}</span>
                      {index === 0 && (
                        <span className="ml-2 rounded-md bg-creaw-canvas px-2 py-1 text-xs text-creaw-faint">
                          Entry
                        </span>
                      )}
                      {index === stages.length - 1 && (
                        <span className="ml-2 rounded-md bg-creaw-canvas px-2 py-1 text-xs text-creaw-faint">
                          Exit
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label={`Move ${stage.name} up`}
                        disabled={busy || index === 0}
                        onClick={() => open("move", stage, "up")}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label={`Move ${stage.name} down`}
                        disabled={busy || index === stages.length - 1}
                        onClick={() => open("move", stage, "down")}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label={`Rename ${stage.name}`}
                        disabled={busy}
                        onClick={() => open("rename", stage)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label={`Remove ${stage.name}`}
                        disabled={busy || stages.length <= 1}
                        onClick={() => open("remove", stage)}
                      >
                        <Trash2 className="text-creaw-danger" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="p-5 text-xs text-creaw-faint">
                Reordering updates stage_definition.step_no. Existing participant events retain
                their stage references and audit history.
              </p>
            </>
          ) : (
            <div className="p-8">
              <h3 className="font-heading text-xl font-bold">
                {selected?.name} has no pipeline yet
              </h3>
              <p className="mt-2 max-w-lg text-sm text-creaw-body">
                Create a pathway before participants can be staged here.
              </p>
              <Button className="mt-4" onClick={() => open("create")}>
                <Plus />
                Create {selected?.name} pipeline
              </Button>
            </div>
          )}
        </section>
        <aside className="min-w-64 flex-[1_1_280px] space-y-4">
          <div className="rounded-2xl border border-creaw-line bg-white p-5">
            <h2 className="font-heading text-xl font-bold">Stage counts by pillar</h2>
            <dl className="mt-3 space-y-3">
              {pillars.map((pillar) => (
                <div key={pillar.id} className="flex items-center gap-3 text-sm">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: colors[pillar.code] ?? "#B4552E" }}
                  />
                  <dt className="flex-1">{pillar.name}</dt>
                  <dd className="font-bold">
                    {pipelines.find((row) => row.pillar_id === pillar.id)?.stages.length ?? 0}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          {pillars.some(
            (row) =>
              row.code.toLowerCase() === "leadership" &&
              !pipelines.some((pipe) => pipe.pillar_id === row.id)
          ) && (
            <div className="rounded-2xl border border-dashed border-creaw-line bg-white p-5">
              <h2 className="font-heading text-xl font-bold">Leadership</h2>
              <p className="mt-2 text-sm text-creaw-body">
                Has a pillar row but no pipeline_definition yet, so participants cannot be staged in
                it.
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => {
                  setSelectedId(pillars.find((row) => row.code.toLowerCase() === "leadership")!.id);
                  open("create");
                }}
              >
                <Plus />
                Create pipeline
              </Button>
            </div>
          )}
        </aside>
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
      <Dialog
        open={modal !== null}
        onOpenChange={(value) => {
          if (!value && !busy) setModal(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
          <DialogTitle>
            {modal === "add"
              ? "Add stage"
              : modal === "rename"
                ? "Rename stage"
                : modal === "move"
                  ? `Move stage ${direction}`
                  : modal === "remove"
                    ? "Remove stage"
                    : "Create pipeline"}
          </DialogTitle>
          <DialogDescription>
            {modal === "remove"
              ? `Remove “${target?.name}”? Existing records keep their stage history, but active records may need to move to another stage.`
              : modal === "move"
                ? `Move “${target?.name}” ${direction} in the ${selected?.name} pipeline?`
                : (selected?.name ?? "Pipeline configuration")}
          </DialogDescription>
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-creaw-danger-soft p-3 text-sm text-creaw-danger"
            >
              {error}
            </p>
          )}
          {modal === "move" || modal === "remove" ? (
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button
                variant={modal === "remove" ? "destructive" : "default"}
                disabled={busy || !target}
                onClick={() => {
                  if (!target) return;
                  void execute(
                    modal === "move"
                      ? moveStageAction({ stageId: target.id, direction })
                      : removeStageAction({ stageId: target.id }),
                    modal === "move" ? "Stage moved." : "Stage removed."
                  );
                }}
              >
                {busy ? "Saving…" : modal === "move" ? "Move stage" : "Remove stage"}
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {modal === "create" && (
                <label className="block text-sm font-medium">
                  Pipeline name
                  <input
                    className={fieldClass}
                    name="name"
                    required
                    maxLength={160}
                    defaultValue={
                      selected?.name === "Leadership"
                        ? "Women in leadership pathway"
                        : `${selected?.name} pathway`
                    }
                  />
                </label>
              )}
              {(modal === "add" || modal === "rename") && (
                <label className="block text-sm font-medium">
                  Stage name
                  <input
                    className={fieldClass}
                    name="name"
                    required
                    maxLength={160}
                    defaultValue={modal === "rename" ? target?.name : ""}
                    autoFocus
                  />
                </label>
              )}
              {modal === "add" && (
                <label className="block text-sm font-medium">
                  Position
                  <select className={fieldClass} name="position" defaultValue={stages.length + 1}>
                    {stages.map((stage, index) => (
                      <option key={stage.id} value={index + 1}>
                        Before {index + 1}. {stage.name}
                      </option>
                    ))}
                    <option value={stages.length + 1}>At the end</option>
                  </select>
                </label>
              )}
              {modal === "create" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium">
                    First stage
                    <input
                      className={fieldClass}
                      name="firstStage"
                      required
                      maxLength={160}
                      defaultValue="Mobilisation"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Final stage
                    <input
                      className={fieldClass}
                      name="lastStage"
                      required
                      maxLength={160}
                      defaultValue="Graduation"
                    />
                  </label>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : modal === "create" ? "Create pipeline" : "Save"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
