/**
 * Typed client for the MERL overview: totals, pillar reach, monthly activity and previews.
 *
 * `create*Api(client, token)` maps API DTOs into view models and is what tests
 * exercise directly; the exported singleton binds it to the signed-in session
 * for Server Components. Responses are envelope-validated with Zod; the API
 * applies permission and pillar-scope filtering and masks sensitive fields.
 */
import type { ApiClient } from "@/lib/api/client";
import { withSessionApi } from "@/lib/api/session-api";
import { MONTHS_SHORT } from "@/lib/format";
import { pillarLookBySlug, shownPillars } from "@/components/portal/pillars";
import { daysUntil } from "@/features/reporting/status";
import { locationParams, type LocationQuery } from "@/lib/api/location";
import { dashboardOverviewSchema } from "./schemas";

export interface DashboardPillar {
  id: number;
  code: string;
  name: string;
  reached: number;
  target: number;
  color: string;
  href: string;
  /** Enrollments still active, for the card's mini stat. */
  active?: number;
  /** The pillar lead's name, when the user may read it. */
  lead?: string | null;
}
export interface DashboardOverview {
  activeParticipants: number;
  /** Participants living with a disability; absent from an API that predates it. */
  pwdParticipants?: number | null;
  /** The period the activity figures cover. */
  period: { from: string; to: string };
  /** Participants registered in the period. */
  newInPeriod: number;
  /** Registrations in the equal-length period before, for the trend. */
  previousPeriod?: number;
  /** Current enrollments across the pillars in scope. */
  enrollmentCount?: number;
  pendingSubmissions: number;
  overdueReports: number;
  /** Every report on the calendar, submitted or not. */
  totalReports?: number;
  pillars: DashboardPillar[];
  /** One entry per month of the period; `month` is a short label, e.g. "Jul" or "Jul 25". */
  monthly: { key: string; month: string; newCount: number; completedCount: number }[];
  participantDistribution: { name: string; count: number; color: string; href?: string }[];
  reportingAlerts: string[];
  /** Active projects across the pillars in scope, soonest to end first. */
  projects: import("@/features/projects/schemas").ProjectCard[];
  recentSubmissions: {
    id: number;
    title: string;
    pillar: string;
    /** What was captured, from the enrollment's entry category. */
    type?: string;
    pillarColor?: string;
    status: string;
    captured: string;
  }[];
  upcomingReports: {
    id: number;
    /** Unique across narrative and grant reports. */
    key?: string;
    title: string;
    /** The donor programme the report is owed to. */
    project?: string;
    status: string;
    periodEnd: string;
    dueDate?: string;
  }[];
  /** Referrals waiting on a response; absent when the user cannot view referrals. */
  referrals?: DashboardReferrals | null;
  /** One pillar's pipeline funnel; absent when the user cannot see any. */
  funnel?: DashboardFunnel | null;
  /** Newest audit entries; `who` is the officer, or "System" for background jobs. */
  recentActivity: {
    id: number;
    action: string;
    entity: string;
    entityId?: number | null;
    /** "HTTP" for the portal and mobile app, "KAFKA" for background jobs. */
    source?: string | null;
    when: string;
    who: string;
  }[];
}

export interface DashboardReferrals {
  open: number;
  /** Open longer than `overdueAfterDays`. */
  overdue: number;
  overdueAfterDays: number;
  decidedInPeriod: number;
  /** Share of the period's decisions that were acceptances, or null with none decided. */
  acceptedRate: number | null;
  byDestination: {
    pillarId: number;
    pillar: string;
    color: string;
    open: number;
    oldestDays: number;
  }[];
  /** The open referrals waiting longest, oldest first. */
  oldest: {
    id: number;
    participant: string;
    from: string;
    to: string;
    raisedOn: string;
    ageDays: number;
  }[];
}

export interface DashboardFunnel {
  /** Pillar slug, e.g. "srhr". */
  pillar: string;
  name: string;
  color: string;
  pipelineName: string;
  /** Current enrollments in the pillar, whether or not they have reached a stage. */
  enrollments: number;
  /** Enrollments that have reached each stage or a later one. */
  stages: { name: string; count: number }[];
  /** Pillars the user may switch the funnel to. */
  available: { slug: string; name: string }[];
}

/** Presentation for each pillar code; the schema has no targets, so they live here. */
const pillarPresentation: Record<
  string,
  { slug: string; label: string; target: number; color: string }
> = {
  VAWG: { slug: "vawg", label: "VAWG", target: 450, color: "#B4552E" },
  WEE: { slug: "wee", label: "WEE", target: 300, color: "#D9772B" },
  SRHR: { slug: "srhr", label: "SRHR", target: 320, color: "#C9921F" },
  LEADERSHIP: { slug: "leadership", label: "Leadership", target: 0, color: "#6E6459" },
  WROS: { slug: "wros", label: "WROs", target: 16, color: "#9C6B4E" },
  SKILLING: { slug: "skilling", label: "Skilling", target: 200, color: "#7A3A1F" },
};

/** The overview's presentation for a pillar the API does not describe. */
const unknownPillar = (code: string) => ({
  slug: code.toLowerCase(),
  label: code,
  target: 1,
  color: "#6E6459",
});

/** e.g. "SRHR narrative report (Hewlett Foundation) is 12 days overdue". */
const overdueAlert = (row: { title: string; project: string; due_date: string }) => {
  const days = Math.max(0, -daysUntil(row.due_date));
  return `${row.title} (${row.project}) is ${days} day${days === 1 ? "" : "s"} overdue`;
};

export function createDashboardApi(client: ApiClient, token: string) {
  return {
    /**
     * Every panel of the overview from one call: the API counts, groups and scopes them.
     * @param period What happened is counted between these days (inclusive).
     * @param chartPillar A pillar slug narrowing the monthly chart; every pillar when omitted.
     * @param funnelPillar The pillar slug whose funnel to show; the API picks one when omitted.
     * @param location The area every people-based figure is narrowed to.
     */
    async getOverview(
      period: { from: string; to: string },
      chartPillar?: string,
      funnelPillar?: string,
      location: LocationQuery = {}
    ): Promise<DashboardOverview> {
      const result = await client.request(
        {
          method: "GET",
          path: "/dashboard",
          routeTemplate: "/dashboard",
          token,
          query: {
            view: "overview",
            from: period.from,
            to: period.to,
            ...(chartPillar ? { pillar: chartPillar } : {}),
            ...(funnelPillar ? { funnel: funnelPillar } : {}),
            ...locationParams(location),
          },
        },
        dashboardOverviewSchema
      );
      if (!result.success || !result.data) throw new Error(result.message);
      const dto = result.data;
      const pillars: DashboardPillar[] = shownPillars(dto.pillars).map((pillar) => {
        const key = pillar.code.toUpperCase();
        const presentation = pillarPresentation[key] ?? unknownPillar(pillar.code);
        return {
          id: pillar.id,
          code: presentation.slug,
          name: presentation.label,
          reached: pillar.reached,
          target: presentation.target,
          color: presentation.color,
          href: `/pillars/${presentation.slug}`,
          active: pillar.active,
          lead: pillar.lead_name,
        };
      });
      const reportingAlerts = (dto.reports?.overdue ?? []).map(overdueAlert);
      const pillarById = (id: number) => {
        const pillar = dto.pillars.find((row) => row.id === id);
        return pillar
          ? (pillarPresentation[pillar.code.toUpperCase()] ?? unknownPillar(pillar.code))
          : null;
      };
      const pillarBySlug = (slug: string) =>
        pillarPresentation[slug.toUpperCase()] ?? unknownPillar(slug);
      return {
        activeParticipants: dto.participant_count,
        pwdParticipants: dto.pwd_count,
        period: dto.period,
        newInPeriod: dto.new_in_period,
        previousPeriod: dto.previous_period,
        enrollmentCount: dto.enrollment_count,
        pendingSubmissions: dto.pending_submissions ?? 0,
        overdueReports: reportingAlerts.length,
        totalReports: dto.reports?.total ?? 0,
        pillars,
        monthly: dto.monthly.map((row) => {
          // Months carry their year only when the period spans more than one.
          const [year, month] = row.month.split("-");
          const spansYears = dto.monthly.some((item) => !item.month.startsWith(year));
          return {
            key: row.month,
            month: `${MONTHS_SHORT[Number(month) - 1]}${spansYears ? ` ${year.slice(2)}` : ""}`,
            newCount: row.new_count,
            completedCount: row.completed_count,
          };
        }),
        participantDistribution: pillars.map(({ name, reached, color, href }) => ({
          name: pillarLookBySlug(href.split("/").pop() ?? "")?.fullName ?? name,
          count: reached,
          color,
          href,
        })),
        reportingAlerts,
        projects: dto.projects,
        recentSubmissions: (dto.recent_submissions ?? []).map((row) => {
          const pillar = pillars.find((item) => item.id === row.pillar_id);
          return {
            id: row.id,
            title: row.title ?? `Submission #${row.id}`,
            pillar: pillar?.name ?? "Programme",
            type: row.category ?? undefined,
            pillarColor: pillar?.color,
            status: row.status === "disputed" ? "Flagged" : "Pending review",
            captured: row.event_date,
          };
        }),
        upcomingReports: (dto.reports?.upcoming ?? []).map((row) => ({
          id: row.id,
          key: row.key,
          title: row.title,
          project: row.project,
          status: row.status,
          periodEnd: row.period_end,
          dueDate: row.due_date,
        })),
        referrals: dto.referrals && {
          open: dto.referrals.open,
          overdue: dto.referrals.overdue,
          overdueAfterDays: dto.referrals.overdue_after_days,
          decidedInPeriod: dto.referrals.decided_in_period,
          acceptedRate: dto.referrals.accepted_rate,
          byDestination: dto.referrals.by_destination.map((row) => {
            const pillar = pillarById(row.pillar_id);
            return {
              pillarId: row.pillar_id,
              pillar: pillar?.label ?? "Another pillar",
              color: pillar?.color ?? unknownPillar("").color,
              open: row.open,
              oldestDays: row.oldest_days,
            };
          }),
          oldest: dto.referrals.oldest.map((row) => ({
            id: row.id,
            participant: row.participant_name ?? "Participant record",
            from: pillarById(row.from_pillar_id)?.label ?? "Another pillar",
            to: row.destination_name ?? pillarById(row.to_pillar_id)?.label ?? "Another pillar",
            raisedOn: row.raised_on,
            ageDays: row.age_days,
          })),
        },
        funnel: dto.funnel && {
          pillar: pillarBySlug(dto.funnel.code).slug,
          name: pillarBySlug(dto.funnel.code).label,
          color: pillarBySlug(dto.funnel.code).color,
          pipelineName: dto.funnel.pipeline_name,
          enrollments: dto.funnel.enrollments,
          stages: dto.funnel.stages.map((row) => ({ name: row.name, count: row.reached })),
          available: dto.funnel.available.map((code) => ({
            slug: pillarBySlug(code).slug,
            name: pillarBySlug(code).label,
          })),
        },
        recentActivity: (dto.recent_activity ?? []).map((row) => ({
          id: row.id,
          action: row.action,
          entity: row.entity_type,
          entityId: row.entity_id,
          source: row.source,
          when: row.performed_at,
          who: row.performed_by_name ?? (row.source === "KAFKA" ? "System" : "Unknown user"),
        })),
      };
    },
  };
}

export const dashboardApi = {
  async getOverview(
    period: { from: string; to: string },
    chartPillar?: string,
    funnelPillar?: string,
    location?: LocationQuery
  ) {
    return (await withSessionApi(createDashboardApi)).getOverview(
      period,
      chartPillar,
      funnelPillar,
      location
    );
  },
};
