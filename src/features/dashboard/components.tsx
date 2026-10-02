import { Activity, CalendarClock, Camera, Users } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { PillarCard } from "@/components/ui/pillar-card";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { pillarLookBySlug } from "@/components/portal/pillars";
import type { DashboardOverview } from "./api";
import { ProjectsPanel } from "@/features/projects/projects-panel";
import { PipelineFunnel } from "@/features/pillars/overview/pipeline-funnel";
import { FunnelPicker } from "./sections/chart-filters";
import { MonthlyChart, ParticipantsDonut } from "./sections/charts";
import { ReferralOversight } from "./sections/referrals";
import { ActivityFeed, CalendarPreview, FieldPreview, OverdueAlert } from "./sections/panels";

/** "▲ 11%" against the quarter before, or the quarter's months when there is nothing to compare. */
function quarterTrend(current: number, previous: number | undefined, year: string) {
  if (!previous) return { label: `Jul–Sep ${year}`, tone: "neutral" as StatusTone };
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return { label: "No change", tone: "neutral" as StatusTone };
  return change > 0
    ? { label: `▲ ${change}%`, tone: "success" as StatusTone }
    : { label: `▼ ${-change}%`, tone: "danger" as StatusTone };
}

/**
 * MERL overview: overdue-report alert, headline totals, pillar reach, monthly
 * enrollments, participant mix, pipeline funnel, referral oversight, and previews
 * of field work, reporting and audit.
 */
export function DashboardContent({
  overview,
  year,
  chartPillar,
  canViewSubmissions = true,
  canViewParticipants = false,
  canViewAudit = false,
}: {
  overview: DashboardOverview;
  year: string;
  /** The pillar slug the monthly chart is narrowed to; all pillars when omitted. */
  chartPillar?: string;
  /** Hides links into the submissions queue for users who cannot open it. */
  canViewSubmissions?: boolean;
  canViewParticipants?: boolean;
  canViewAudit?: boolean;
}) {
  const trend = quarterTrend(overview.newThisQuarter, overview.previousQuarter, year);
  const participantsHref = canViewParticipants ? "/participants" : undefined;
  return (
    <div className="flex flex-col gap-[22px]">
      <OverdueAlert alerts={overview.reportingAlerts} />
      <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active participants"
          value={overview.activeParticipants.toLocaleString()}
          icon={<Users />}
          tint="#FBEDE5"
          ink="#B4552E"
          href={participantsHref}
          detail={
            <StatusBadge tone="neutral">
              {overview.enrollmentCount === undefined
                ? "In your scope"
                : `${overview.enrollmentCount.toLocaleString()} enrollments`}
            </StatusBadge>
          }
        />
        <MetricCard
          label="New this quarter"
          value={overview.newThisQuarter.toLocaleString()}
          icon={<Activity />}
          tint="#FDF1DE"
          ink="#B26A12"
          href={participantsHref}
          detail={<StatusBadge tone={trend.tone}>{trend.label}</StatusBadge>}
        />
        <MetricCard
          label="Submissions to review"
          value={overview.pendingSubmissions.toLocaleString()}
          icon={<Camera />}
          tint="#F3EAE3"
          ink="#7A3A1F"
          href={canViewSubmissions ? "/field-submissions" : undefined}
          detail={<StatusBadge tone="warning">from mobile</StatusBadge>}
        />
        <MetricCard
          label="Reports overdue"
          value={overview.overdueReports.toLocaleString()}
          icon={<CalendarClock />}
          tint="#FBE9E6"
          ink="#B8352C"
          href="/reporting"
          detail={
            <StatusBadge tone={overview.overdueReports ? "danger" : "success"}>
              {overview.totalReports === undefined
                ? "Needs follow-up"
                : `of ${overview.totalReports} due`}
            </StatusBadge>
          }
        />
      </div>
      <section aria-labelledby="pillar-glance" className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="pillar-glance" className="font-heading text-[22px] font-bold">
            {overview.pillars.length === 1 ? "Your pillar" : "Pillars at a glance"}
          </h2>
          <p className="text-[13.5px] text-creaw-faint">Reach against {year} annual targets</p>
        </div>
        <div className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-3">
          {overview.pillars.map((pillar) => {
            const look = pillarLookBySlug(pillar.code);
            const percent =
              pillar.target > 0 ? Math.round((pillar.reached / pillar.target) * 100) : 0;
            return (
              <PillarCard
                key={pillar.id}
                name={pillar.name}
                description={
                  pillar.target > 0
                    ? (look?.fullName ?? "Programme records")
                    : "Pipeline configuration pending"
                }
                value={pillar.reached}
                target={pillar.target}
                unit={look?.unit}
                color={pillar.color}
                tint={look?.tint}
                icon={look?.icon}
                stats={[
                  ["Active", (pillar.active ?? pillar.reached).toLocaleString()],
                  ["Of target", pillar.target > 0 ? `${percent}%` : "—"],
                ]}
                lead={pillar.lead}
                href={pillar.href}
              />
            );
          })}
        </div>
      </section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <MonthlyChart
          monthly={overview.monthly}
          year={year}
          pillar={chartPillar}
          pillars={overview.pillars}
          funnel={overview.funnel?.pillar}
        />
        {overview.pillars.length !== 1 && (
          <ParticipantsDonut distribution={overview.participantDistribution} />
        )}
      </div>
      {(overview.funnel || overview.referrals) && (
        <div className="grid gap-5 xl:grid-cols-2">
          {overview.funnel && (
            <PipelineFunnel
              title={`${overview.funnel.name} pipeline`}
              subtitle={`${overview.funnel.enrollments.toLocaleString()} current enrollments · how many reached each stage`}
              color={overview.funnel.color}
              stages={overview.funnel.stages}
              emptyMessage="No stages configured yet."
              actions={
                <FunnelPicker
                  funnel={overview.funnel.pillar}
                  options={overview.funnel.available}
                  year={year}
                  pillar={chartPillar ?? ""}
                />
              }
            />
          )}
          {overview.referrals && <ReferralOversight referrals={overview.referrals} />}
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <FieldPreview submissions={overview.recentSubmissions} canView={canViewSubmissions} />
        <CalendarPreview reports={overview.upcomingReports} />
      </div>
      <ProjectsPanel
        projects={overview.projects}
        subtitle="Active funded initiatives across your pillars"
        showPillar
      />
      <ActivityFeed activity={overview.recentActivity} canViewAudit={canViewAudit} />
    </div>
  );
}
