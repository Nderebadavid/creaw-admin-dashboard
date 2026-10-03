import { Accessibility, Globe, UserCheck, Users } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";

/**
 * The registry's headline counts, from the list's facets: participants per status,
 * disability and refugee status over the pillar, location and search filters.
 * Without counts (an API that returns no facets) each card shows a dash.
 */
export function ParticipantSummaryCards({
  facets,
}: {
  facets?: Record<string, Record<string, number>>;
}) {
  const status = facets?.status;
  const total = Object.values(status ?? {}).reduce((sum, value) => sum + value, 0);
  const active = status?.ACTIVE ?? 0;
  const pwd = facets?.is_person_with_disability?.true ?? 0;
  const refugees = facets?.is_refugee?.true ?? 0;
  const shown = (value: number) => (status ? value.toLocaleString() : "—");
  const share = (value: number) => (total ? `${Math.round((value / total) * 100)}%` : "0%");
  return (
    <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        inline
        label="Participants"
        value={shown(total)}
        icon={<Users />}
        detail={
          <StatusBadge tone="neutral">{(total - active).toLocaleString()} inactive</StatusBadge>
        }
      />
      <MetricCard
        inline
        label="Active"
        value={shown(active)}
        icon={<UserCheck />}
        detail={<StatusBadge tone="success">{share(active)}</StatusBadge>}
      />
      <MetricCard
        inline
        label="Persons with disability"
        value={shown(pwd)}
        icon={<Accessibility />}
        detail={<StatusBadge tone="info">{share(pwd)}</StatusBadge>}
      />
      <MetricCard
        inline
        label="Refugees"
        value={shown(refugees)}
        icon={<Globe />}
        detail={<StatusBadge tone="neutral">{share(refugees)}</StatusBadge>}
      />
    </div>
  );
}
