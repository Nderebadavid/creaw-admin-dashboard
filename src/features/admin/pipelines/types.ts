import { pillarLookBySlug } from "@/components/portal/pillars";
import type { PipelineView, StageView } from "../api";

export type PipelinePillar = { id: number; code: string; name: string };
export type PipelineRecord = PipelineView & { stages: StageView[] };

/** What the open stage dialog is doing, and to which stage. */
export type StageModal =
  | { kind: "add" | "create" }
  | { kind: "rename" | "remove"; stage: StageView }
  | { kind: "move"; stage: StageView; direction: "up" | "down" };

/** The pillar's accent colour for tabs and counts, shared with the rest of the portal. */
export const pillarColor = (code: string) => pillarLookBySlug(code)?.color ?? "#B4552E";
