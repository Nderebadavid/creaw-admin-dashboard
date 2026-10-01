import { vi, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PillarContent } from "./components";
import type { PillarView } from "./api";
// Grant rows navigate to their sign-off page with the app router.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("./actions", () => ({
  listPillarRecordsAction: vi.fn(),
  listPillarDomainAction: vi.fn(),
  updatePillarRecordAction: vi.fn(),
  createPillarRecordAction: vi.fn(),
  createPillarDomainAction: vi.fn(),
}));

describe("pillar screen", () => {
  it("explains a pillar with no configured pipeline", () => {
    const pillar: PillarView = {
      id: 4,
      code: "leadership",
      name: "Leadership",
      fullName: "Leadership",
      leadUserId: null,
      color: "#6E6459",
      tint: "#EFEAE4",
      target: 0,
      records: [],
      stages: [],
      hasPipeline: false,
      recordCount: 0,
      activeCount: 0,
      pipelineStages: [],
      projects: [],
      cards: { vawg: null, sessions: null, curriculum: null, trainees: null },
    };
    const html = renderToStaticMarkup(<PillarContent pillar={pillar} canCreate={false} />);
    expect(html).toContain("Leadership");
    expect(html).toContain("No pipeline configured");
    expect(html).toContain("Programme records");
    expect(html).toContain("No target set");
    expect(html).not.toContain("designer programme target");
  });
  it("only links to pillars in the caller's scope", () => {
    const pillar: PillarView = {
      id: 1,
      code: "vawg",
      name: "VAWG",
      fullName: "Violence Against Women & Girls",
      leadUserId: 5,
      color: "#B4552E",
      tint: "#FBEDE5",
      target: 450,
      records: [],
      stages: ["Intake"],
      hasPipeline: true,
      recordCount: 0,
      activeCount: 0,
      pipelineStages: [],
      projects: [],
      cards: { vawg: null, sessions: null, curriculum: null, trainees: null },
    };
    const html = renderToStaticMarkup(
      <PillarContent pillar={pillar} canCreate={false} availableCodes={["vawg"]} />
    );
    expect(html).toContain('href="/pillars/vawg"');
    expect(html).not.toContain('href="/pillars/wee"');
    expect(html).toContain("VAWG</a>");
  });
  it("shows mobile submissions in a pillar preview", () => {
    const pillar: PillarView = {
      id: 1,
      code: "vawg",
      name: "VAWG",
      fullName: "Violence Against Women & Girls",
      leadUserId: 5,
      color: "#B4552E",
      tint: "#FBEDE5",
      target: 450,
      records: [],
      stages: ["Intake"],
      hasPipeline: true,
      recordCount: 0,
      activeCount: 0,
      pipelineStages: [],
      projects: [],
      cards: { vawg: null, sessions: null, curriculum: null, trainees: null },
    };
    const html = renderToStaticMarkup(
      <PillarContent
        pillar={pillar}
        canCreate={false}
        submissions={[
          {
            id: 1,
            title: "Court attendance",
            type: "Case update",
            pillarId: 1,
            pillar: "VAWG",
            captured: "2026-09-27",
            source: "mobile",
            status: "Pending review",
            flag: null,
          },
        ]}
      />
    );
    expect(html).toContain("Field submissions");
    expect(html).toContain("Court attendance");
  });
  it("does not link to submissions without the viewing grant", () => {
    const pillar: PillarView = {
      id: 1,
      code: "vawg",
      name: "VAWG",
      fullName: "Violence Against Women & Girls",
      leadUserId: 5,
      color: "#B4552E",
      tint: "#FBEDE5",
      target: 450,
      records: [],
      stages: ["Intake"],
      hasPipeline: true,
      recordCount: 0,
      activeCount: 0,
      pipelineStages: [],
      projects: [],
      cards: { vawg: null, sessions: null, curriculum: null, trainees: null },
    };
    expect(
      renderToStaticMarkup(
        <PillarContent pillar={pillar} canCreate={false} canViewSubmissions={false} />
      )
    ).not.toContain('href="/field-submissions"');
  });
  it("shows the grant applications as the primary searchable workflow", () => {
    const pillar: PillarView = {
      id: 2,
      code: "wee",
      name: "WEE",
      fullName: "Women's Economic Empowerment",
      leadUserId: 3,
      color: "#D9772B",
      tint: "#FDF1DE",
      target: 300,
      records: [],
      stages: ["Intake"],
      hasPipeline: true,
      recordCount: 0,
      activeCount: 0,
      pipelineStages: [],
      projects: [],
      cards: { vawg: null, sessions: null, curriculum: null, trainees: null },
      domain: {
        title: "Grant applications",
        subtitle: "Prepared → Reviewed → Approved sign-off chain",
        columns: ["Applicant", "Business", "Requested"],
        rows: [
          {
            id: 1,
            title: "Application #1",
            values: ["Rehema Karisa", "Posho mill", "KES 120,000"],
            status: "PREPARED",
            updated: "2026-09-20T08:00:00Z",
          },
        ],
        totalItems: 1,
        statuses: ["ACTIVE", "PREPARED"],
      },
    };
    const html = renderToStaticMarkup(
      <PillarContent
        pillar={pillar}
        canCreate={false}
        domainActions={<span>New application</span>}
      />
    );
    expect(html).toContain("Grant applications");
    expect(html).toContain("Rehema Karisa");
    expect(html).toContain("Search grant applications");
    expect(html).toContain("New application");
  });

  it("shows the pipeline as a progression funnel, with create in the records toolbar and no heading block", () => {
    const pillar: PillarView = {
      id: 2,
      code: "wee",
      name: "WEE",
      fullName: "Women's Economic Empowerment",
      leadUserId: 3,
      color: "#D9772B",
      tint: "#FDF1DE",
      target: 300,
      records: [],
      stages: [],
      hasPipeline: true,
      recordCount: 0,
      activeCount: 0,
      pipelineStages: [],
      projects: [],
      cards: { vawg: null, sessions: null, curriculum: null, trainees: null },
      stageCounts: [
        { name: "Intake", count: 40 },
        { name: "Training", count: 30 },
        { name: "Graduation", count: 10 },
      ],
    };
    const html = renderToStaticMarkup(
      <PillarContent
        heading={{ title: pillar.fullName, section: "Pillars", description: "WEE pillar" }}
        pillar={pillar}
        canCreate
        actions={<button type="button">New application</button>}
      />
    );
    expect(html).toContain("WEE pipeline");
    expect(html).toContain("Participant progression this year");
    expect(html).toContain("Training");
    expect(html).toContain("75%");
    // The title lives in the portal header; the page keeps it only as a screen-reader heading.
    expect(html).toContain('<h1 class="sr-only">Women&#x27;s Economic Empowerment</h1>');
    expect(html).toContain("Home");
    expect(html).toContain("Pillars");
    expect(html).not.toContain("WEE pillar");
    // Create sits with the records, not in the heading.
    expect(html.indexOf("New application")).toBeGreaterThan(html.indexOf("WEE pipeline"));
  });
});
