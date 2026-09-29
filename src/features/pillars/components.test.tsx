import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PillarContent } from "./components";
import type { PillarView } from "./api";

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
    };
    expect(
      renderToStaticMarkup(
        <PillarContent pillar={pillar} canCreate={false} canViewSubmissions={false} />
      )
    ).not.toContain('href="/field-submissions"');
  });
  it("shows the case register as the primary searchable workflow", () => {
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
      domain: {
        title: "Legal case register",
        subtitle: "Survivor names masked",
        columns: ["Case", "Case type"],
        rows: [{ id: 1, title: "Case #1", values: ["Case #1", "Assault"], status: "in hearing" }],
      },
    };
    const html = renderToStaticMarkup(
      <PillarContent
        pillar={pillar}
        canCreate={false}
        domainActions={<span>Open legal case</span>}
      />
    );
    expect(html).toContain("Legal case register");
    expect(html).toContain("Case #1");
    expect(html).toContain("Search legal case register");
    expect(html).toContain("Open legal case");
  });
});
