import { BookOpenCheck, CalendarCheck, Layers, Users } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { SessionSummary } from "../model";

/** The sessions page's four headline cards, in the pillar's colours. */
export function SessionSummaryCards({
  summary,
  color,
  tint,
}: {
  summary: SessionSummary;
  color: string;
  tint: string;
}) {
  return (
    <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        inline
        label="Sessions held"
        value={summary.sessionsHeld.toLocaleString()}
        icon={<CalendarCheck />}
        tint={tint}
        ink={color}
        detail={<StatusBadge tone="neutral">in period</StatusBadge>}
      />
      <MetricCard
        inline
        label="People reached"
        value={summary.peopleReached.toLocaleString()}
        icon={<Users />}
        tint={tint}
        ink={color}
        detail={<StatusBadge tone="info">distinct attendees</StatusBadge>}
      />
      <MetricCard
        inline
        label="Topics covered"
        value={`${summary.topicsCovered.toLocaleString()} of ${summary.topicsPlanned.toLocaleString()}`}
        icon={<BookOpenCheck />}
        tint={tint}
        ink={color}
        detail={<StatusBadge tone="success">planned topics</StatusBadge>}
      />
      <MetricCard
        inline
        label="Active activity types"
        value={summary.activeTypes.toLocaleString()}
        icon={<Layers />}
        tint={tint}
        ink={color}
        detail={<StatusBadge tone="neutral">configured</StatusBadge>}
      />
    </div>
  );
}
