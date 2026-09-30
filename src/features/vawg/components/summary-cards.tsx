import { Brain, CircleCheck, Scale, Users } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { VawgSummary } from "../model";

/** The VAWG page's four headline cards, in the pillar's colours. */
export function VawgSummaryCards({
  summary,
  color,
  tint,
}: {
  summary: VawgSummary;
  color: string;
  tint: string;
}) {
  return (
    <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        inline
        label="Survivors supported"
        value={summary.survivors.toLocaleString()}
        icon={<Users />}
        tint={tint}
        ink={color}
        detail={<StatusBadge tone="neutral">enrolled in VAWG</StatusBadge>}
      />
      <MetricCard
        inline
        label="Open legal cases"
        value={summary.openCases.toLocaleString()}
        icon={<Scale />}
        tint={tint}
        ink={color}
        detail={<StatusBadge tone="info">in progress</StatusBadge>}
      />
      <MetricCard
        inline
        label="Counselling sessions"
        value={summary.sessions.toLocaleString()}
        icon={<Brain />}
        tint={tint}
        ink={color}
        detail={
          <StatusBadge tone="success">{summary.sessionsThisQuarter} this quarter</StatusBadge>
        }
      />
      <MetricCard
        inline
        label="Cases concluded"
        value={summary.concluded.toLocaleString()}
        icon={<CircleCheck />}
        tint={tint}
        ink={color}
        detail={<StatusBadge tone="success">closed</StatusBadge>}
      />
    </div>
  );
}
