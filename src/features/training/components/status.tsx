import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import {
  handoffLabels,
  trainingStatusLabels,
  type HandoffStage,
  type TrainingStatus,
} from "../model";

const statusTones: Record<TrainingStatus, StatusTone> = {
  ongoing: "info",
  completed: "success",
  dropped_out: "warning",
};
const handoffTones: Record<HandoffStage, StatusTone> = {
  none: "neutral",
  referred: "info",
  declined: "danger",
  accepted: "info",
  application_filed: "warning",
  awarded: "success",
};

export function TrainingStatusBadge({ status }: { status: TrainingStatus }) {
  return <StatusBadge tone={statusTones[status]}>{trainingStatusLabels[status]}</StatusBadge>;
}

/** Where a trainee's grant recommendation has got, e.g. "With WEE". */
export function HandoffBadge({ stage }: { stage: HandoffStage }) {
  return <StatusBadge tone={handoffTones[stage]}>{handoffLabels[stage]}</StatusBadge>;
}
