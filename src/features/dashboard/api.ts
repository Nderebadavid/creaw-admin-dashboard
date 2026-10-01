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
  newThisQuarter: number;
  /** Registrations in the quarter before, for the "New this quarter" trend. */
  previousQuarter?: number;
  /** Current enrollments across the pillars in scope. */
  enrollmentCount?: number;
  pendingSubmissions: number;
  overdueReports: number;
  /** Every report on the calendar, submitted or not. */
  totalReports?: number;
  pillars: DashboardPillar[];
  monthly: { month: string; newCount: number; completedCount: number }[];
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
     * @param period The year charted in "Monthly enrollments".
     * @param chartPillar A pillar slug narrowing that chart; every pillar when omitted.
     */
    async getOverview(period: string, chartPillar?: string): Promise<DashboardOverview> {
      const year = /^20\d{2}$/.test(period) ? period : "2026";
      const result = await client.request(
        {
          method: "GET",
          path: "/dashboard",
          routeTemplate: "/dashboard",
          token,
          query: { view: "overview", year, ...(chartPillar ? { pillar: chartPillar } : {}) },
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
      return {
        activeParticipants: dto.participant_count,
        newThisQuarter: dto.new_this_quarter,
        previousQuarter: dto.previous_quarter,
        enrollmentCount: dto.enrollment_count,
        pendingSubmissions: dto.pending_submissions ?? 0,
        overdueReports: reportingAlerts.length,
        totalReports: dto.reports?.total ?? 0,
        pillars,
        monthly: dto.monthly.map((row) => ({
          month: MONTHS_SHORT[row.month - 1],
          newCount: row.new_count,
          completedCount: row.completed_count,
        })),
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
  async getOverview(period: string, chartPillar?: string) {
    return (await withSessionApi(createDashboardApi)).getOverview(period, chartPillar);
  },
};
