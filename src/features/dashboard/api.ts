import type { ApiClient } from "@/lib/api/client";
import { createPortalApiClient } from "@/lib/api/portal-client";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { dashboardAuditSchema, dashboardDtoSchema, dashboardEnrollmentSchema, dashboardParticipantSchema, dashboardReportSchema, dashboardSubmissionSchema } from "./schemas";

export interface DashboardPillar { id: number; code: string; name: string; reached: number; target: number; color: string; href: string }
export interface DashboardOverview {
  activeParticipants: number;
  newThisQuarter: number;
  pendingSubmissions: number;
  overdueReports: number;
  pillars: DashboardPillar[];
  monthly: { month: string; newCount: number; completedCount: number }[];
  participantDistribution: { name: string; count: number; color: string }[];
  reportingAlerts: string[];
  recentSubmissions: { id: number; title: string; pillar: string; status: string; captured: string }[];
  upcomingReports: { id: number; title: string; status: string; periodEnd: string }[];
  recentActivity: { id: number; action: string; entity: string; when: string }[];
}

const pillarPresentation: Record<string, { slug: string; target: number; color: string }> = {
  VAWG: { slug: "vawg", target: 450, color: "#B4552E" },
  WEE: { slug: "wee", target: 300, color: "#D9772B" },
  SRHR: { slug: "srhr", target: 320, color: "#C9921F" },
  LEADERSHIP: { slug: "leadership", target: 0, color: "#6E6459" },
  WROS: { slug: "wros", target: 16, color: "#9C6B4E" },
  SKILLING: { slug: "skilling", target: 200, color: "#7A3A1F" },
};

export function createDashboardApi(client: ApiClient, token: string) {
  return {
    async getOverview(period: string): Promise<DashboardOverview> {
      const year = /^20\d{2}$/.test(period) ? period : "2026";
      const response = await client.request({ method: "GET", path: "/dashboard", routeTemplate: "/dashboard", token }, dashboardDtoSchema);
      if (!response.success || !response.data) throw new Error(response.message);
      const dto = response.data;
      const optional = async <T>(fn: () => Promise<T>): Promise<T | null> => { try { return await fn(); } catch { return null; } };
      const [participants, submissions, reports, audit, ...enrollments] = await Promise.all([
        optional(() => client.request({ method: "GET", path: "/participants", routeTemplate: "/participants", token, query: { pageSize: 100 } }, dashboardParticipantSchema)),
        optional(() => client.request({ method: "GET", path: "/field-submissions", routeTemplate: "/field-submissions", token, query: { pageSize: 100 } }, dashboardSubmissionSchema)),
        optional(() => client.request({ method: "GET", path: "/reports", routeTemplate: "/reports", token, query: { pageSize: 100 } }, dashboardReportSchema)),
        optional(() => client.request({ method: "GET", path: "/audit-logs", routeTemplate: "/audit-logs", token, query: { pageSize: 100, sortBy: "performed_at", sortOrder: "desc" } }, dashboardAuditSchema)),
        ...dto.pillars.map(pillar => optional(() => client.request({ method: "GET", path: `/pillars/${pillar.code.toLowerCase()}`, routeTemplate: "/pillars/:pillar", token, query: { table: "enrollment", pageSize: 100 } }, dashboardEnrollmentSchema))),
      ]);
      const pillarCards = dto.pillars.map((pillar, index) => {
        const presentation = pillarPresentation[pillar.code.toUpperCase()] ?? { slug: pillar.code.toLowerCase(), target: 1, color: "#6E6459" };
        return { id: pillar.id, code: presentation.slug, name: pillar.code === "WROS" ? "WROs" : pillar.code === "SKILLING" ? "Skilling" : pillar.code === "LEADERSHIP" ? "Leadership" : pillar.code, reached: enrollments[index]?.data?.totalItems ?? 0, target: presentation.target, color: presentation.color, href: `/pillars/${presentation.slug}` };
      });
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const participantDates = participants?.data?.items.map(row => row.created_at) ?? [];
      const verifiedDates = submissions?.data?.items.filter(row => row.stage_event_status === "verified").map(row => row.event_date) ?? [];
      const monthly = monthNames.map((month, index) => ({ month,
        newCount: participantDates.filter(date => date.startsWith(`${year}-${String(index + 1).padStart(2, "0")}`)).length,
        completedCount: verifiedDates.filter(date => date.startsWith(`${year}-${String(index + 1).padStart(2, "0")}`)).length,
      }));
      const reportingAlerts = reports?.data?.items.filter(row => row.report_status === "overdue").map(row => row.notes || "A report is overdue") ?? [];
      const enrollmentPillars = new Map(enrollments.flatMap((response, index) => response?.data?.items.map(row => [row.id, pillarCards[index]?.name] as const) ?? []));
      const quarterStart = new Date(`${year}-07-01`).getTime(), quarterEnd = new Date(`${year}-10-01`).getTime();
      return {
        activeParticipants: dto.participantCount,
        newThisQuarter: participantDates.filter(date => { const time = Date.parse(date); return time >= quarterStart && time < quarterEnd; }).length,
        pendingSubmissions: submissions?.data?.items.filter(row => row.stage_event_status !== "verified").length ?? 0,
        overdueReports: reportingAlerts.length,
        pillars: pillarCards,
        monthly,
        participantDistribution: pillarCards.map(pillar => ({ name: pillar.name, count: pillar.reached, color: pillar.color })),
        reportingAlerts,
        recentSubmissions: submissions?.data?.items.filter(row => row.stage_event_status !== "verified").slice(0, 4).map(row => ({ id: row.id, title: row.notes?.split(" — ")[0] ?? `Submission #${row.id}`, pillar: enrollmentPillars.get(row.enrollment_id) ?? "Programme", status: row.stage_event_status === "disputed" ? "Flagged" : "Pending review", captured: row.event_date })) ?? [],
        upcomingReports: reports?.data?.items.filter(row => row.report_status !== "submitted").slice(0, 4).map(row => ({ id: row.id, title: row.notes ?? `Report #${row.id}`, status: row.report_status, periodEnd: row.reporting_period_end })) ?? [],
        recentActivity: audit?.data?.items.slice(0, 5).map(row => ({ id: row.id, action: row.action, entity: row.entity_type, when: row.performed_at })) ?? [],
      };
    },
  };
}

export const dashboardApi = {
  async getOverview(period: string) {
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    if (!token) throw new Error("Sign in required");
    return createDashboardApi(createPortalApiClient(), token).getOverview(period);
  },
};
