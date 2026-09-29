import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
vi.mock("./actions", () => ({ createPillarRecordAction: vi.fn(), updatePillarRecordAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { PillarCreateButton } from "./record-controls";

describe("pillar record controls", () => {
  it("opens the scoped enrollment form", () => {
    render(<PillarCreateButton code="vawg" name="VAWG" />);
    fireEvent.click(screen.getByRole("button", { name: "Add VAWG record" }));
    expect(screen.getByLabelText("Participant ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Programme category")).toBeInTheDocument();
  });
});
