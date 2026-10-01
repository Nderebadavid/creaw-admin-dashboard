import { ArrowLeftRight, CircleCheck, CircleX, Inbox } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";

/**
 * The referral queue's headline counts, from the list's `status` facet: referrals
 * per status over the pillar and search filters, whichever status chip is selected.
 * Without counts (an API that returns no facet) each card shows a dash.
 */
export function ReferralSummaryCards({ counts }: { counts?: Record<string, number> }) {
  const count = (status: string) => counts?.[status] ?? 0;
  const total = Object.values(counts ?? {}).reduce((sum, value) => sum + value, 0);
  const shown = (value: number) => (counts ? value.toLocaleString() : "—");
  const decided = count("ACCEPTED") + count("DECLINED");
  return (
    <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        inline
        label="Referrals"
        value={shown(total)}
        icon={<ArrowLeftRight />}
        detail={
          <StatusBadge tone="neutral">{count("WITHDRAWN").toLocaleString()} withdrawn</StatusBadge>
        }
      />
      <MetricCard
        inline
        label="Awaiting decision"
        value={shown(count("NEW"))}
        icon={<Inbox />}
        detail={<StatusBadge tone="warning">new</StatusBadge>}
      />
      <MetricCard
        inline
        label="Accepted"
        value={shown(count("ACCEPTED"))}
        icon={<CircleCheck />}
        detail={
          <StatusBadge tone="success">
            {decided ? `${Math.round((count("ACCEPTED") / decided) * 100)}%` : "0%"} of decided
          </StatusBadge>
        }
      />
      <MetricCard
        inline
        label="Declined"
        value={shown(count("DECLINED"))}
        icon={<CircleX />}
        detail={<StatusBadge tone="danger">by destination</StatusBadge>}
      />
    </div>
  );
}
