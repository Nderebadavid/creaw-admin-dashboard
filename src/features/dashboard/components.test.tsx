import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
// The chart's pillar and year pickers navigate with the app router.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
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
      projects: [],
      reportingAlerts: ["SRHR narrative report (Hewlett Foundation) is 12 days overdue"],
      recentSubmissions: [],
      upcomingReports: [],
      recentActivity: [],
    };
    const html = renderToStaticMarkup(<DashboardContent overview={overview} year="2026" />);
    expect(html).toContain("Active participants");
    expect(html).toContain("Submissions to review");
    // A single pillar in scope is "your" pillar, and there is no mix to chart.
    expect(html).toContain("Your pillar");
    expect(html).not.toContain("Participants by pillar");
    expect(html).toContain(
      "<strong>SRHR narrative report (Hewlett Foundation)</strong> is 12 days overdue."
    );
    // Each KPI opens the records behind it; pillar cards name what the target counts.
    expect(html).toContain('href="/reporting"');
    expect(html).toContain("of 450 survivors");
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
      projects: [],
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
      projects: [],
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
      projects: [],
      reportingAlerts: [
        "SRHR narrative report is 12 days overdue",
        "WEE quarterly return is 3 days overdue",
      ],
      recentSubmissions: [],
      upcomingReports: [
        {
          id: 1,
          title: "SRHR narrative report",
          project: "Hewlett Foundation",
          status: "overdue",
          periodEnd: "2026-09-15",
        },
      ],
      recentActivity: [
        {
          id: 1,
          action: "UPDATE",
          entity: "participant",
          entityId: 7,
          source: "HTTP",
          when: "2026-09-27T09:00:00.000Z",
          who: "Judy Mwangi",
        },
      ],
    };
    const html = renderToStaticMarkup(<DashboardContent overview={overview} year="2026" />);
    expect(html).toContain("<strong>SRHR narrative report</strong> is 12 days overdue.");
    expect(html).toContain("1 more report is overdue.");
    expect(html).toContain("Open reporting calendar →");
    expect(html).toContain("Pillars at a glance");
    expect(html).toContain("Monthly enrollments");
    expect(html).toContain("New enrollments");
    expect(html).toContain('aria-label="Participants by pillar: VAWG 4 (40%), WEE 6 (60%)"');
    expect(html).toContain("Next 30 days");
    expect(html).toContain('href="/reporting"');
    expect(html).toContain("See all");
    expect(html).toContain("Hewlett Foundation");
    expect(html).toContain(">Overdue<");
    expect(html).toContain("Judy Mwangi");
    expect(html).toContain(">JM<");
    expect(html).toContain("participant #7");
    expect(html).toContain("Participant · via portal");
  });

  it("shows referral oversight and the pipeline funnel when the API returns them", () => {
    const overview: DashboardOverview = {
      activeParticipants: 0,
      newThisQuarter: 0,
      pendingSubmissions: 0,
      overdueReports: 0,
      pillars: [],
      monthly: [],
      participantDistribution: [],
      projects: [],
      reportingAlerts: [],
      recentSubmissions: [],
      upcomingReports: [],
      recentActivity: [],
      referrals: {
        open: 3,
        overdue: 1,
        overdueAfterDays: 7,
        decidedThisQuarter: 4,
        acceptedRate: 75,
        byDestination: [{ pillarId: 2, pillar: "WEE", color: "#D9772B", open: 3, oldestDays: 9 }],
        oldest: [
          {
            id: 1,
            participant: "Faith Njeri",
            from: "VAWG",
            to: "WEE",
            raisedOn: "2026-09-23",
            ageDays: 9,
          },
        ],
      },
      funnel: {
        pillar: "srhr",
        name: "SRHR",
        color: "#C9921F",
        pipelineName: "SRHR pathway",
        enrollments: 40,
        stages: [
          { name: "Registered", count: 40 },
          { name: "Baseline", count: 10 },
        ],
        available: [
          { slug: "vawg", name: "VAWG" },
          { slug: "srhr", name: "SRHR" },
        ],
      },
    };
    const html = renderToStaticMarkup(<DashboardContent overview={overview} year="2026" />);
    expect(html).toContain("Referral oversight");
    expect(html).toContain("Waiting over 7 days");
    expect(html).toContain("75%");
    expect(html).toContain("Faith Njeri");
    expect(html).toContain("VAWG → WEE");
    expect(html).toContain('href="/referrals"');
    expect(html).toContain("SRHR pipeline");
    expect(html).toContain("40 current enrollments");
    expect(html).toContain('aria-label="Pipeline pillar"');
    expect(html).toContain("25%");
  });

  it("leaves both panels out when the user may see neither", () => {
    const overview: DashboardOverview = {
      activeParticipants: 0,
      newThisQuarter: 0,
      pendingSubmissions: 0,
      overdueReports: 0,
      pillars: [],
      monthly: [],
      participantDistribution: [],
      projects: [],
      reportingAlerts: [],
      recentSubmissions: [],
      upcomingReports: [],
      recentActivity: [],
      referrals: null,
      funnel: null,
    };
    const html = renderToStaticMarkup(<DashboardContent overview={overview} year="2026" />);
    expect(html).not.toContain("Referral oversight");
    expect(html).not.toContain("pipeline");
  });

  it("shows persons with disability as a share of participants", () => {
    const overview: DashboardOverview = {
      activeParticipants: 40,
      pwdParticipants: 6,
      newThisQuarter: 0,
      pendingSubmissions: 0,
      overdueReports: 0,
      pillars: [],
      monthly: [],
      participantDistribution: [],
      projects: [],
      reportingAlerts: [],
      recentSubmissions: [],
      upcomingReports: [],
      recentActivity: [],
    };
    const html = renderToStaticMarkup(<DashboardContent overview={overview} year="2026" />);
    expect(html).toContain("Persons with disability");
    expect(html).toContain("15% of participants");
    // An API without the count leaves the card out instead of showing zero.
    const older = renderToStaticMarkup(
      <DashboardContent overview={{ ...overview, pwdParticipants: undefined }} year="2026" />
    );
    expect(older).not.toContain("Persons with disability");
  });
});
