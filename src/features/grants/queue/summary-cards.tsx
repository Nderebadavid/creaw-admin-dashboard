import { CircleCheck, CircleX, FileText, Hourglass } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";

/**
 * The grants page's headline counts, from the list's `status` facet: applications
 * per stage over the pillar and search filters, whichever stage chip is selected.
 * Without counts (an API that returns no facet) each card shows a dash.
 */
export function GrantSummaryCards({ counts }: { counts?: Record<string, number> }) {
  const count = (status: string) => counts?.[status] ?? 0;
  const total = Object.values(counts ?? {}).reduce((sum, value) => sum + value, 0);
  const shown = (value: number) => (counts ? value.toLocaleString() : "—");
  const share = (value: number) => (total ? `${Math.round((value / total) * 100)}%` : "0%");
  return (
    <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        inline
        label="Applications"
        value={shown(total)}
        icon={<FileText />}
        detail={<StatusBadge tone="neutral">all stages</StatusBadge>}
      />
      <MetricCard
        inline
        label="Awaiting sign-off"
        value={shown(total - count("APPROVED") - count("DECLINED"))}
        icon={<Hourglass />}
        detail={<StatusBadge tone="warning">in the chain</StatusBadge>}
      />
      <MetricCard
        inline
        label="Approved"
        value={shown(count("APPROVED"))}
        icon={<CircleCheck />}
        detail={<StatusBadge tone="success">{share(count("APPROVED"))}</StatusBadge>}
      />
      <MetricCard
        inline
        label="Declined"
        value={shown(count("DECLINED"))}
        icon={<CircleX />}
        detail={<StatusBadge tone="danger">{share(count("DECLINED"))}</StatusBadge>}
      />
    </div>
  );
}
