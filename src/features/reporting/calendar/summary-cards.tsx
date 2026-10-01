import { CalendarClock, CircleAlert, CircleCheck, FileText } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";

/**
 * The reporting calendar's headline counts, from the list's `status` facet: reports
 * per status over the pillar, owner and search filters, whichever status chip is
 * selected. Without counts (an API that returns no facet) each card shows a dash.
 */
export function ReportSummaryCards({ counts }: { counts?: Record<string, number> }) {
  const count = (status: string) => counts?.[status] ?? 0;
  const total = Object.values(counts ?? {}).reduce((sum, value) => sum + value, 0);
  const shown = (value: number) => (counts ? value.toLocaleString() : "—");
  return (
    <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        inline
        label="Reports"
        value={shown(total)}
        icon={<FileText />}
        detail={<StatusBadge tone="neutral">narrative and grant</StatusBadge>}
      />
      <MetricCard
        inline
        label="Overdue"
        value={shown(count("overdue"))}
        icon={<CircleAlert />}
        detail={
          <StatusBadge tone={count("overdue") ? "danger" : "success"}>
            {count("overdue") ? "follow up" : "none late"}
          </StatusBadge>
        }
      />
      <MetricCard
        inline
        label="Pending"
        value={shown(count("pending"))}
        icon={<CalendarClock />}
        detail={<StatusBadge tone="warning">not yet due</StatusBadge>}
      />
      <MetricCard
        inline
        label="Submitted"
        value={shown(count("submitted"))}
        icon={<CircleCheck />}
        detail={
          <StatusBadge tone="success">
            {total ? `${Math.round((count("submitted") / total) * 100)}%` : "0%"} of reports
          </StatusBadge>
        }
      />
    </div>
  );
}
