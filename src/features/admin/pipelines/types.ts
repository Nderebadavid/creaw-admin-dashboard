import type { PipelineView, StageView } from "../api";

export type PipelinePillar = { id: number; code: string; name: string };
export type PipelineRecord = PipelineView & { stages: StageView[] };

/** What the open stage dialog is doing, and to which stage. */
export type StageModal =
  | { kind: "add" | "create" }
  | { kind: "rename" | "remove"; stage: StageView }
  | { kind: "move"; stage: StageView; direction: "up" | "down" };

const colors: Record<string, string> = {
  VAWG: "#C04F53",
  WEE: "#DB8A45",
  SRHR: "#58A891",
  LEADERSHIP: "#9D83BB",
  WRO: "#7198BE",
  SKILLING: "#DEB859",
};

/** The pillar's accent colour for tabs and counts. */
export const pillarColor = (code: string) => colors[code] ?? "#B4552E";
