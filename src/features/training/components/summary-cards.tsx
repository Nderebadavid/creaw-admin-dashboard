import { Award, Briefcase, GraduationCap, Users } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { TrainingSummary } from "../model";

const rate = (value: number | null) => (value === null ? "—" : `${value}%`);

/** The Skilling page's four headline trainee cards, in the pillar's colours. */
export function TrainingSummaryCards({
  summary,
  color,
  tint,
}: {
  summary: TrainingSummary;
  color: string;
  tint: string;
}) {
  return (
    <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        inline
        label="Trainees enrolled"
        value={summary.enrolled.toLocaleString()}
        icon={<Users />}
        tint={tint}
        ink={color}
        detail={<StatusBadge tone="neutral">all placements</StatusBadge>}
      />
      <MetricCard
        inline
        label="Completion rate"
        value={rate(summary.completionRate)}
        icon={<GraduationCap />}
        tint={tint}
        ink={color}
        detail={
          <StatusBadge tone="info">
            {`${summary.completed} completed · ${summary.droppedOut} dropped out`}
          </StatusBadge>
        }
      />
      <MetricCard
        inline
        label="In work"
        value={rate(summary.inWorkRate)}
        icon={<Briefcase />}
        tint={tint}
        ink={color}
        detail={<StatusBadge tone="success">{`${summary.inWork} of completers`}</StatusBadge>}
      />
      <MetricCard
        inline
        label="Recommended for grants"
        value={summary.recommended.toLocaleString()}
        icon={<Award />}
        tint={tint}
        ink={color}
        detail={
          <StatusBadge tone="neutral">{`${summary.acceptedByWee} accepted by WEE`}</StatusBadge>
        }
      />
    </div>
  );
}
