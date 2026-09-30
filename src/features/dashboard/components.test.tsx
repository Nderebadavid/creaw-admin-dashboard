import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardContent } from "./components";
import type { DashboardOverview } from "./api";

describe("dashboard screen", () => {
  it("shows the four totals, pillar cards, and reporting alert", () => {
    const overview: DashboardOverview = {
      activeParticipants: 10,
      newThisQuarter: 3,
      pendingSubmissions: 2,
      overdueReports: 1,
      pillars: [
        {
          id: 1,
          code: "vawg",
          name: "VAWG",
          reached: 4,
          target: 450,
          color: "#B4552E",
          href: "/pillars/vawg",
        },
      ],
      monthly: [{ month: "Jan", newCount: 2, completedCount: 1 }],
      participantDistribution: [{ name: "VAWG", count: 4, color: "#B4552E" }],
      reportingAlerts: ["SRHR narrative report overdue"],
      recentSubmissions: [],
      upcomingReports: [],
      recentActivity: [],
    };
    const html = renderToStaticMarkup(<DashboardContent overview={overview} year="2026" />);
    expect(html).toContain("Active participants");
    expect(html).toContain("Submissions to review");
    expect(html).toContain("Pillars at a glance");
    expect(html).toContain("SRHR narrative report overdue");
  });
  it("marks Leadership as awaiting a configured target", () => {
    const overview: DashboardOverview = {
      activeParticipants: 0,
      newThisQuarter: 0,
      pendingSubmissions: 0,
      overdueReports: 0,
      pillars: [
        {
          id: 4,
          code: "leadership",
          name: "Leadership",
          reached: 0,
          target: 0,
          color: "#6E6459",
          href: "/pillars/leadership",
        },
      ],
      monthly: [],
      participantDistribution: [],
      reportingAlerts: [],
      recentSubmissions: [],
      upcomingReports: [],
      recentActivity: [],
    };
    expect(renderToStaticMarkup(<DashboardContent overview={overview} year="2026" />)).toContain(
      "No target set"
    );
  });
  it("does not link to submissions without the viewing grant", () => {
    const overview: DashboardOverview = {
      activeParticipants: 0,
      newThisQuarter: 0,
      pendingSubmissions: 0,
      overdueReports: 0,
      pillars: [],
      monthly: [],
      participantDistribution: [],
      reportingAlerts: [],
      recentSubmissions: [],
      upcomingReports: [],
      recentActivity: [],
    };
    expect(
      renderToStaticMarkup(
        <DashboardContent overview={overview} year="2026" canViewSubmissions={false} />
      )
    ).not.toContain('href="/field-submissions"');
  });

  it("follows the design's dashboard sections", () => {
    const overview: DashboardOverview = {
      activeParticipants: 10,
      newThisQuarter: 3,
      pendingSubmissions: 2,
      overdueReports: 2,
      pillars: [],
      monthly: [{ month: "Jan", newCount: 2, completedCount: 1 }],
      participantDistribution: [
        { name: "VAWG", count: 4, color: "#B4552E" },
        { name: "WEE", count: 6, color: "#D9772B" },
      ],
      reportingAlerts: [
        "SRHR narrative report is 12 days overdue",
        "WEE quarterly return is 3 days overdue",
      ],
      recentSubmissions: [],
      upcomingReports: [
        { id: 1, title: "SRHR narrative report", status: "overdue", periodEnd: "2026-09-15" },
      ],
      recentActivity: [
        {
          id: 1,
          action: "UPDATE",
          entity: "participant",
          when: "2026-09-27T09:00:00.000Z",
          who: "Judy Mwangi",
        },
      ],
    };
    const html = renderToStaticMarkup(<DashboardContent overview={overview} year="2026" />);
    expect(html).toContain("SRHR narrative report is 12 days overdue.");
    expect(html).toContain("1 more report is overdue.");
    expect(html).toContain("Open reporting calendar →");
    expect(html).toContain("Monthly enrollments");
    expect(html).toContain("New enrollments");
    expect(html).toContain('aria-label="Participants by pillar: VAWG 4 (40%), WEE 6 (60%)"');
    expect(html).toContain("Next 30 days");
    expect(html).toContain('href="/reporting"');
    expect(html).toContain("See all");
    expect(html).toContain("Judy Mwangi");
    expect(html).toContain(">JM<");
  });
});
