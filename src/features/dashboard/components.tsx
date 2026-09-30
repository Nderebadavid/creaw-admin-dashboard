import Link from "next/link";
import { Activity, CalendarClock, Camera, Users } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { PillarCard } from "@/components/ui/pillar-card";
import type { DashboardOverview } from "./api";
import { MonthlyChart, ParticipantsDonut } from "./sections/charts";
import { ActivityFeed, CalendarPreview, FieldPreview, OverdueAlert } from "./sections/panels";

/**
 * MERL overview: overdue-report alert, headline totals, pillar reach, monthly
 * enrollments, participant mix, and previews of field work, reporting and audit.
 */
export function DashboardContent({
  overview,
  year,
  canViewSubmissions = true,
}: {
  overview: DashboardOverview;
  year: string;
  /** Hides links into the submissions queue for users who cannot open it. */
  canViewSubmissions?: boolean;
}) {
  return (
    <div className="space-y-6">
      <OverdueAlert alerts={overview.reportingAlerts} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active participants"
          value={overview.activeParticipants.toLocaleString()}
          icon={<Users />}
          tint="#FBEDE5"
          ink="#B4552E"
          detail={<span className="text-xs text-creaw-faint">Across your pillar scope</span>}
        />
        <MetricCard
          label="New this quarter"
          value={overview.newThisQuarter.toLocaleString()}
          icon={<Activity />}
          tint="#FDF1DE"
          ink="#B26A12"
          detail={<span className="text-xs text-creaw-faint">Jul–Sep {year}</span>}
        />
        <MetricCard
          label="Submissions to review"
          value={overview.pendingSubmissions.toLocaleString()}
          icon={<Camera />}
          tint="#F3EAE3"
          ink="#7A3A1F"
          detail={
            canViewSubmissions ? (
              <Link href="/field-submissions" className="text-xs font-semibold text-primary">
                From mobile →
              </Link>
            ) : (
              <span className="text-xs text-creaw-faint">From mobile</span>
            )
          }
        />
        <MetricCard
          label="Reports overdue"
          value={overview.overdueReports.toLocaleString()}
          icon={<CalendarClock />}
          tint="#FBE9E6"
          ink="#B8352C"
          detail={<span className="text-xs text-creaw-faint">Needs follow-up</span>}
        />
      </div>
      <section aria-labelledby="pillar-glance">
        <div className="mb-4">
          <h2 id="pillar-glance" className="font-heading text-2xl font-bold">
            Pillars at a glance
          </h2>
          <p className="text-sm text-creaw-faint">Reach against 2026 annual targets</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {overview.pillars.map((pillar) =>
            pillar.target === 0 ? (
              <article
                key={pillar.id}
                className="rounded-2xl border border-t-4 bg-white p-5"
                style={{ borderTopColor: pillar.color }}
              >
                <h3 className="font-heading text-xl font-bold">{pillar.name}</h3>
                <p className="mt-1 text-xs text-creaw-faint">Pipeline configuration pending</p>
                <p className="mt-6 text-sm font-semibold">No target set</p>
                <Link
                  href={pillar.href}
                  className="mt-4 inline-flex text-sm font-semibold text-primary"
                >
                  Open {pillar.name} →
                </Link>
              </article>
            ) : (
              <PillarCard
                key={pillar.id}
                name={pillar.name}
                description="Programme records"
                value={pillar.reached}
                target={pillar.target}
                color={pillar.color}
                href={pillar.href}
              />
            )
          )}
        </div>
      </section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)]">
        <MonthlyChart monthly={overview.monthly} year={year} />
        <ParticipantsDonut distribution={overview.participantDistribution} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <FieldPreview submissions={overview.recentSubmissions} canView={canViewSubmissions} />
        <CalendarPreview reports={overview.upcomingReports} />
      </div>
      <ActivityFeed activity={overview.recentActivity} />
    </div>
  );
}
