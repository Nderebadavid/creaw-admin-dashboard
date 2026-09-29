import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("./actions", () => ({ createPillarRecordAction: vi.fn(), updatePillarRecordAction: vi.fn(), createPillarDomainAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { PillarCreateButton, PillarDomainCreateButton } from "./record-controls";

afterEach(cleanup);

describe("pillar record controls", () => {
  it("opens the scoped enrollment form", () => {
    render(<PillarCreateButton code="vawg" name="VAWG" />);
    fireEvent.click(screen.getByRole("button", { name: "Add VAWG record" }));
    expect(screen.getByLabelText("Participant ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Programme category")).toBeInTheDocument();
  });
  it("offers the WRO organisation workflow", () => {
    render(<PillarDomainCreateButton code="wros" />);
    fireEvent.click(screen.getByRole("button", { name: "Add organisation" }));
    expect(screen.getByLabelText("Organisation name")).toBeInTheDocument();
    expect(screen.getByLabelText("Legal form")).toBeInTheDocument();
  });
});
