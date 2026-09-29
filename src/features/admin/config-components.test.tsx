import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("./pipeline-actions", () => ({ addStageAction: vi.fn(), createPipelineAction: vi.fn(), moveStageAction: vi.fn(), removeStageAction: vi.fn(), renameStageAction: vi.fn() }));
vi.mock("./lookup-actions", () => ({ createLookupAction: vi.fn(), updateLookupAction: vi.fn(), setLookupActiveAction: vi.fn() }));
import { PipelineContent } from "./pipeline-components";
import { LookupContent } from "./lookup-components";

describe("configuration controls", () => {
  it("disables movement beyond the first and last stages", () => {
    render(<PipelineContent pillars={[{ id: 1, code: "VAWG", name: "VAWG" }]} pipelines={[{ id: 1, pillar_id: 1, name: "VAWG pathway", version: 1, status: "ACTIVE", is_deleted: false, stages: [
      { id: 1, pipeline_id: 1, step_no: 1, name: "Intake", description: null, status: "ACTIVE", is_deleted: false },
      { id: 2, pipeline_id: 1, step_no: 2, name: "Closure", description: null, status: "ACTIVE", is_deleted: false },
    ] }]} />);
    expect(screen.getByRole("button", { name: "Move Intake up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Closure down" })).toBeDisabled();
    expect(screen.getByText("Entry")).toBeInTheDocument();
    expect(screen.getByText("Exit")).toBeInTheDocument();
  });

  it("shows the geographic breadcrumb and parent drill-down link", () => {
    render(<LookupContent table="sub_county" rows={[{ id: 4, name: "Kibra", county_id: 2, status: "ACTIVE", is_deleted: false }]} parent={{ id: 2, name: "Nairobi", parentId: null }} counties={[{ id: 2, name: "Nairobi" }]} subCounties={[]} pillars={[]} canViewAudit />);
    expect(screen.getByRole("navigation", { name: "Geography breadcrumb" })).toHaveTextContent("Kenya");
    expect(screen.getByRole("link", { name: /Kibra/ })).toHaveAttribute("href", "/admin/lookups/ward?subCountyId=4&countyId=2");
    expect(screen.getByRole("link", { name: "History" })).toHaveAttribute("href", "/audit?module=sub_county&targetId=4");
  });
});
