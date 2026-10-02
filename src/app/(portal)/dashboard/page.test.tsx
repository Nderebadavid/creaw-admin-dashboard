import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
}));
vi.mock("@/lib/auth/session-server", () => ({
  requireSession: vi.fn(async () => ({
    user: { firstName: "Lead" },
    grants: [
      { permissionCode: "DASHBOARD_VIEW", pillarId: 1 },
      { permissionCode: "FIELD_SUBMISSION_VIEW", pillarId: 1 },
    ],
  })),
}));
vi.mock("@/features/dashboard/api", () => ({
  dashboardApi: {
    getOverview: vi.fn(async () => ({
      activeParticipants: 1,
      period: { from: "2026-07-01", to: "2026-09-30" },
      newInPeriod: 1,
      pendingSubmissions: 1,
      overdueReports: 0,
      pillars: [],
      monthly: [],
      participantDistribution: [],
      projects: [],
      reportingAlerts: [],
      recentSubmissions: [],
      upcomingReports: [],
      recentActivity: [],
    })),
  },
}));
import DashboardPage from "./page";

describe("dashboard route", () => {
  it("composes the page for a pillar-scoped dashboard grant", async () => {
    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("MERL overview");
    expect(html).toContain('href="/field-submissions"');
  });
});
