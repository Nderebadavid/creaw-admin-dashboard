/**
 * Typed client for the MERL overview: totals, pillar reach, monthly activity and previews.
 *
 * `create*Api(client, token)` maps API DTOs into view models and is what tests
 * exercise directly; the exported singleton binds it to the signed-in session
 * for Server Components. Responses are envelope-validated with Zod; the API
 * applies permission and pillar-scope filtering and masks sensitive fields.
 */
import type { ApiClient, ApiClientRequest } from "@/lib/api/client";
import { withSessionApi } from "@/lib/api/session-api";
import { collectPages } from "@/lib/api/pagination";
import type { ApiEnvelope, PaginatedData } from "@/types/api";
import { MONTHS_SHORT } from "@/lib/format";
import type { z } from "zod";
import {
  dashboardAuditSchema,
  dashboardDtoSchema,
  dashboardEnrollmentSchema,
  dashboardParticipantSchema,
  dashboardReportSchema,
  dashboardSubmissionSchema,
} from "./schemas";

export interface DashboardPillar {
  id: number;
  code: string;
  name: string;
  reached: number;
  target: number;
  color: string;
  href: string;
}
export interface DashboardOverview {
  activeParticipants: number;
  newThisQuarter: number;
  pendingSubmissions: number;
  overdueReports: number;
  pillars: DashboardPillar[];
  monthly: { month: string; newCount: number; completedCount: number }[];
  participantDistribution: { name: string; count: number; color: string }[];
  reportingAlerts: string[];
  recentSubmissions: {
    id: number;
    title: string;
    pillar: string;
    status: string;
    captured: string;
  }[];
  upcomingReports: { id: number; title: string; status: string; periodEnd: string }[];
  /** Newest audit entries; `who` is the officer, or "System" for background jobs. */
  recentActivity: { id: number; action: string; entity: string; when: string; who: string }[];
}

type Sources = Awaited<ReturnType<typeof fetchSources>>;
type Participants = Sources["participants"];
type Submissions = Sources["submissions"];
type Reports = Sources["reports"];
type PillarDto = Sources["dto"]["pillars"][number];

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

/** Resolves to null instead of throwing, so one failing panel doesn't blank the dashboard. */
async function optional<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch {
    return null;
  }
}

type Query = Record<string, string | number>;

/** Every record the overview needs, fetched in parallel where the calls are independent. */
async function fetchSources(client: ApiClient, token: string) {
  const get = async <T>(
    path: string,
    routeTemplate: ApiClientRequest["routeTemplate"],
    schema: z.ZodType<ApiEnvelope<T | null>>,
    query: Query = {}
  ): Promise<T> => {
    const result = await client.request(
      { method: "GET", path, routeTemplate, token, query },
      schema
    );
    if (!result.success || !result.data) throw new Error(result.message);
    return result.data;
  };
  const allPages = <T>(
    path: string,
    routeTemplate: ApiClientRequest["routeTemplate"],
    schema: z.ZodType<ApiEnvelope<PaginatedData<T> | null>>,
    query: Query = {}
  ) =>
    collectPages((page, pageSize) =>
      get(path, routeTemplate, schema, { ...query, page, pageSize })
    );

  const [dto, participants, submissions, reports, audit] = await Promise.all([
    get("/dashboard", "/dashboard", dashboardDtoSchema),
    optional(() => allPages("/participants", "/participants", dashboardParticipantSchema)),
    optional(() => allPages("/field-submissions", "/field-submissions", dashboardSubmissionSchema)),
    optional(() => allPages("/reports", "/reports", dashboardReportSchema)),
    // Only the newest five entries are shown; the API sorts, so one page is enough.
    optional(async () => {
      const query = { page: 1, pageSize: 5, sortBy: "performed_at", sortOrder: "desc" };
      return (await get("/audit-logs", "/audit-logs", dashboardAuditSchema, query)).items;
    }),
  ]);
  // Per-pillar enrollments need the pillar list from /dashboard.
  const enrollments = await Promise.all(
    dto.pillars.map((pillar) =>
      optional(() =>
        allPages(
          `/pillars/${pillar.code.toLowerCase()}`,
          "/pillars/:pillar",
          dashboardEnrollmentSchema,
          {
            table: "enrollment",
          }
        )
      )
    )
  );
  return { dto, participants, submissions, reports, audit, enrollments };
}

/** Reach per pillar: current enrollments against the presentation target. */
function buildPillarCards(
  pillars: PillarDto[],
  enrollments: ({ id: number }[] | null)[]
): DashboardPillar[] {
  return pillars.map((pillar, index) => {
    const key = pillar.code.toUpperCase();
    const presentation = pillarPresentation[key] ?? {
      slug: pillar.code.toLowerCase(),
      label: pillar.code,
      target: 1,
      color: "#6E6459",
    };
    return {
      id: pillar.id,
      code: presentation.slug,
      name: presentation.label,
      reached: enrollments[index]?.length ?? 0,
      target: presentation.target,
      color: presentation.color,
      href: `/pillars/${presentation.slug}`,
    };
  });
}

/** New registrations and verified field updates per month of `year`. */
function buildMonthly(
  year: string,
  participants: Participants | null,
  submissions: Submissions | null
) {
  const registered = participants?.map((row) => row.created_at) ?? [];
  const verified =
    submissions
      ?.filter((row) => row.stage_event_status === "verified")
      .map((row) => row.event_date) ?? [];
  return MONTHS_SHORT.map((month, index) => {
    const prefix = `${year}-${String(index + 1).padStart(2, "0")}`;
    return {
      month,
      newCount: registered.filter((date) => date.startsWith(prefix)).length,
      completedCount: verified.filter((date) => date.startsWith(prefix)).length,
    };
  });
}

/** Participants registered in Jul–Sep of `year` (the current reporting quarter). */
function countInQuarter(year: string, participants: Participants | null) {
  const start = new Date(`${year}-07-01`).getTime();
  const end = new Date(`${year}-10-01`).getTime();
  return (participants ?? []).filter((row) => {
    const time = Date.parse(row.created_at);
    return time >= start && time < end;
  }).length;
}

/** e.g. "SRHR narrative report is 12 days overdue", one per overdue report. */
function buildReportingAlerts(reports: Reports | null): string[] {
  const daysLate = (end: string) =>
    Math.max(0, Math.floor((Date.now() - Date.parse(`${end}T00:00:00`)) / 86_400_000));
  return (reports ?? [])
    .filter((row) => row.report_status === "overdue")
    .map((row) => {
      const days = daysLate(row.reporting_period_end);
      return `${row.notes || "A report"} is ${days} day${days === 1 ? "" : "s"} overdue`;
    });
}

/** The four newest unverified submissions, labelled with their pillar. */
function buildRecentSubmissions(
  submissions: Submissions | null,
  pillarByEnrollment: Map<number, string>
) {
  return (submissions ?? [])
    .filter((row) => row.stage_event_status !== "verified")
    .slice(0, 4)
    .map((row) => ({
      id: row.id,
      title: row.notes?.split(" — ")[0] ?? `Submission #${row.id}`,
      pillar: pillarByEnrollment.get(row.enrollment_id) ?? "Programme",
      status: row.stage_event_status === "disputed" ? "Flagged" : "Pending review",
      captured: row.event_date,
    }));
}

export function createDashboardApi(client: ApiClient, token: string) {
  return {
    async getOverview(period: string): Promise<DashboardOverview> {
      const year = /^20\d{2}$/.test(period) ? period : "2026";
      const { dto, participants, submissions, reports, audit, enrollments } = await fetchSources(
        client,
        token
      );
      const pillars = buildPillarCards(dto.pillars, enrollments);
      const pillarByEnrollment = new Map(
        enrollments.flatMap(
          (rows, index) => rows?.map((row) => [row.id, pillars[index]?.name] as const) ?? []
        )
      );
      const reportingAlerts = buildReportingAlerts(reports);
      return {
        activeParticipants: dto.participantCount,
        newThisQuarter: countInQuarter(year, participants),
        pendingSubmissions:
          submissions?.filter((row) => row.stage_event_status !== "verified").length ?? 0,
        overdueReports: reportingAlerts.length,
        pillars,
        monthly: buildMonthly(year, participants, submissions),
        participantDistribution: pillars.map(({ name, reached, color }) => ({
          name,
          count: reached,
          color,
        })),
        reportingAlerts,
        recentSubmissions: buildRecentSubmissions(submissions, pillarByEnrollment),
        upcomingReports: (reports ?? [])
          .filter((row) => row.report_status !== "submitted")
          .slice(0, 4)
          .map((row) => ({
            id: row.id,
            title: row.notes ?? `Report #${row.id}`,
            status: row.report_status,
            periodEnd: row.reporting_period_end,
          })),
        recentActivity: (audit ?? []).slice(0, 5).map((row) => ({
          id: row.id,
          action: row.action,
          entity: row.entity_type,
          when: row.performed_at,
          who: row.performed_by_name ?? (row.source === "KAFKA" ? "System" : "Unknown user"),
        })),
      };
    },
  };
}

export const dashboardApi = {
  async getOverview(period: string) {
    return (await withSessionApi(createDashboardApi)).getOverview(period);
  },
};
