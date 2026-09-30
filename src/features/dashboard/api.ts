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
import { pillarLookBySlug } from "@/components/portal/pillars";
import { catalogSchema, reportPageSchema } from "@/features/reporting/schemas";
import { daysUntil } from "@/features/reporting/status";
import type { z } from "zod";
import {
  dashboardAuditSchema,
  dashboardDtoSchema,
  dashboardEnrollmentSchema,
  dashboardParticipantSchema,
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

  const [dto, participants, submissions, reports, reportCatalog, audit] = await Promise.all([
    get("/dashboard", "/dashboard", dashboardDtoSchema),
    optional(() => allPages("/participants", "/participants", dashboardParticipantSchema)),
    optional(() => allPages("/field-submissions", "/field-submissions", dashboardSubmissionSchema)),
    // The reporting calendar: narrative and grant reports with their donor programme and due date.
    optional(() => allPages("/reports", "/reports", reportPageSchema, { calendar: "true" })),
    // Names the pillar leads; only readable by users who can open the calendar.
    optional(() => get("/reports", "/reports", catalogSchema, { catalog: "true" })),
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
  return { dto, participants, submissions, reports, reportCatalog, audit, enrollments };
}

/** Reach per pillar: current enrollments against the presentation target. */
function buildPillarCards(
  pillars: PillarDto[],
  enrollments: Sources["enrollments"],
  owners: { id: number; name: string }[] | undefined
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
      active: enrollments[index]?.filter((row) => row.status === "ACTIVE").length ?? 0,
      lead: owners?.find((owner) => owner.id === pillar.lead_user_id)?.name ?? null,
    };
  });
}

/** New registrations and verified field updates per month of `year`, already narrowed to a pillar. */
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

/** Participants registered from `from` up to (not including) `to`, both `YYYY-MM-DD`. */
function countBetween(from: string, to: string, participants: Participants | null) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  return (participants ?? []).filter((row) => {
    const time = Date.parse(row.created_at);
    return time >= start && time < end;
  }).length;
}

/** e.g. "SRHR narrative report (Hewlett Foundation) is 12 days overdue", most overdue first. */
function buildReportingAlerts(reports: Reports | null): string[] {
  return (reports ?? [])
    .filter((row) => row.status === "overdue")
    .map((row) => {
      const days = Math.max(0, -daysUntil(row.dueDate));
      return `${row.title} (${row.project}) is ${days} day${days === 1 ? "" : "s"} overdue`;
    });
}

/** The four newest unverified submissions, labelled with their pillar and what was captured. */
function buildRecentSubmissions(
  submissions: Submissions | null,
  enrollmentById: Map<number, { pillar: DashboardPillar; category: string | null }>
) {
  return (submissions ?? [])
    .filter((row) => row.stage_event_status !== "verified")
    .slice(0, 4)
    .map((row) => {
      const enrollment = enrollmentById.get(row.enrollment_id);
      return {
        id: row.id,
        title: row.notes?.split(" — ")[0] ?? `Submission #${row.id}`,
        pillar: enrollment?.pillar.name ?? "Programme",
        type: enrollment?.category ?? undefined,
        pillarColor: enrollment?.pillar.color,
        status: row.stage_event_status === "disputed" ? "Flagged" : "Pending review",
        captured: row.event_date,
      };
    });
}

export function createDashboardApi(client: ApiClient, token: string) {
  return {
    /**
     * @param period The year charted in "Monthly enrollments".
     * @param chartPillar A pillar slug narrowing that chart; every pillar when omitted.
     */
    async getOverview(period: string, chartPillar?: string): Promise<DashboardOverview> {
      const year = /^20\d{2}$/.test(period) ? period : "2026";
      const { dto, participants, submissions, reports, reportCatalog, audit, enrollments } =
        await fetchSources(client, token);
      const pillars = buildPillarCards(dto.pillars, enrollments, reportCatalog?.owners);
      const enrollmentById = new Map(
        enrollments.flatMap(
          (rows, index) =>
            rows?.map(
              (row) => [row.id, { pillar: pillars[index], category: row.entry_category }] as const
            ) ?? []
        )
      );
      const reportingAlerts = buildReportingAlerts(reports);
      // The chart's pillar filter keeps only that pillar's participants and field updates.
      const charted = enrollments[pillars.findIndex((pillar) => pillar.code === chartPillar)];
      const chartedIds = charted && new Set(charted.map((row) => row.id));
      const chartedParticipants = charted && new Set(charted.map((row) => row.participant_id));
      return {
        activeParticipants: dto.participantCount,
        newThisQuarter: countBetween(`${year}-07-01`, `${year}-10-01`, participants),
        previousQuarter: countBetween(`${year}-04-01`, `${year}-07-01`, participants),
        enrollmentCount: dto.enrollmentCount,
        pendingSubmissions:
          submissions?.filter((row) => row.stage_event_status !== "verified").length ?? 0,
        overdueReports: reportingAlerts.length,
        totalReports: reports?.length ?? 0,
        pillars,
        monthly: buildMonthly(
          year,
          chartedParticipants
            ? (participants?.filter((row) => chartedParticipants.has(row.id)) ?? null)
            : participants,
          chartedIds
            ? (submissions?.filter((row) => chartedIds.has(row.enrollment_id)) ?? null)
            : submissions
        ),
        participantDistribution: pillars.map(({ name, reached, color, href }) => ({
          name: pillarLookBySlug(href.split("/").pop() ?? "")?.fullName ?? name,
          count: reached,
          color,
          href,
        })),
        reportingAlerts,
        recentSubmissions: buildRecentSubmissions(submissions, enrollmentById),
        upcomingReports: (reports ?? [])
          .filter((row) => row.status !== "submitted")
          .slice(0, 4)
          .map((row) => ({
            id: row.id,
            key: row.key,
            title: row.title,
            project: row.project,
            status: row.status,
            periodEnd: row.periodEnd,
            dueDate: row.dueDate,
          })),
        recentActivity: (audit ?? []).slice(0, 5).map((row) => ({
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
