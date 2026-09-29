import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("./pipeline-actions", () => ({
  addStageAction: vi.fn(),
  createPipelineAction: vi.fn(),
  moveStageAction: vi.fn(),
  removeStageAction: vi.fn(),
  renameStageAction: vi.fn(),
}));
vi.mock("./lookup-actions", () => ({
  createLookupAction: vi.fn(),
  updateLookupAction: vi.fn(),
  setLookupActiveAction: vi.fn(),
  exportLookupAction: vi.fn(async () => ({ success: false, error: "No download" })),
}));
import { exportLookupAction } from "./lookup-actions";
import { PipelineContent } from "./pipeline-components";
import { LookupContent } from "./lookup-components";

describe("configuration controls", () => {
  it("disables movement beyond the first and last stages", () => {
    render(
      <PipelineContent
        pillars={[{ id: 1, code: "VAWG", name: "VAWG" }]}
        pipelines={[
          {
            id: 1,
            pillar_id: 1,
            name: "VAWG pathway",
            version: 1,
            status: "ACTIVE",
            is_deleted: false,
            stages: [
              {
                id: 1,
                pipeline_id: 1,
                step_no: 1,
                name: "Intake",
                description: null,
                status: "ACTIVE",
                is_deleted: false,
              },
              {
                id: 2,
                pipeline_id: 1,
                step_no: 2,
                name: "Closure",
                description: null,
                status: "ACTIVE",
                is_deleted: false,
              },
            ],
          },
        ]}
      />
    );
    expect(screen.getByRole("button", { name: "Move Intake up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Closure down" })).toBeDisabled();
    expect(screen.getByText("Entry")).toBeInTheDocument();
    expect(screen.getByText("Exit")).toBeInTheDocument();
  });

  it("renders the 101st stage with the correct exit position", () => {
    const stages = Array.from({ length: 101 }, (_, index) => ({
      id: index + 1,
      pipeline_id: 1,
      step_no: index + 1,
      name: `Stage ${index + 1}`,
      description: null,
      status: "ACTIVE",
      is_deleted: false,
    }));
    const html = renderToStaticMarkup(
      <PipelineContent
        pillars={[{ id: 1, code: "VAWG", name: "VAWG" }]}
        pipelines={[
          {
            id: 1,
            pillar_id: 1,
            name: "VAWG pathway",
            version: 1,
            status: "ACTIVE",
            is_deleted: false,
            stages,
          },
        ]}
      />
    );
    expect(html).toContain("Stage 101");
    expect(html).toContain("101 stages");
    expect(html).toContain("Move Stage 101 down");
  });

  it("shows the geographic breadcrumb and parent drill-down link", () => {
    render(
      <LookupContent
        table="sub_county"
        rows={[{ id: 4, name: "Kibra", county_id: 2, status: "ACTIVE", is_deleted: false }]}
        parent={{ id: 2, name: "Nairobi", parentId: null }}
        counties={[{ id: 2, name: "Nairobi" }]}
        subCounties={[]}
        pillars={[]}
        canViewAudit
      />
    );
    expect(screen.getByRole("navigation", { name: "Geography breadcrumb" })).toHaveTextContent(
      "Kenya"
    );
    expect(screen.getByRole("link", { name: /Kibra/ })).toHaveAttribute(
      "href",
      "/admin/lookups/ward?subCountyId=4&countyId=2"
    );
    expect(screen.getByRole("link", { name: "History" })).toHaveAttribute(
      "href",
      "/audit?module=sub_county&targetId=4"
    );
  });

  it("offers CSV only with export permission and submits exactly the visible filtered level", async () => {
    const props = {
      table: "sub_county" as const,
      rows: [
        { id: 4, name: "Kibra", county_id: 2, status: "ACTIVE", is_deleted: false },
        { id: 5, name: "Westlands", county_id: 2, status: "INACTIVE", is_deleted: true },
      ],
      parent: { id: 2, name: "Nairobi", parentId: null },
      counties: [{ id: 2, name: "Nairobi" }],
      subCounties: [],
      pillars: [],
    };
    const { container, rerender } = render(<LookupContent {...props} />);
    expect(within(container).queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
    rerender(<LookupContent {...props} canExport />);
    fireEvent.change(within(container).getByRole("searchbox"), { target: { value: "Kibra" } });
    fireEvent.click(within(container).getByRole("button", { name: "Export CSV" }));
    await waitFor(() =>
      expect(exportLookupAction).toHaveBeenCalledWith({
        table: "sub_county",
        parentId: 2,
        ids: [4],
      })
    );
  });
});
