import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { RecordSection } from "./record-section";
import { RecordStatusBadge } from "./record-status";

afterEach(cleanup);

describe("record section", () => {
  it("shows the status, dates and notes of a record", () => {
    render(
      <RecordSection
        status="ACTIVE"
        created="2026-02-14T08:00:00Z"
        updated="2026-02-20"
        notes={[["Remarks", "Prefers morning visits"]]}
      />
    );
    const section = screen.getByRole("region", { name: "Record" });
    expect(section).toHaveTextContent("Record status");
    expect(within(section).getByText("Active")).toBeInTheDocument();
    expect(section).toHaveTextContent("Created14 Feb 2026");
    expect(section).toHaveTextContent("Last updated20 Feb 2026");
    expect(section).toHaveTextContent("RemarksPrefers morning visits");
    expect(section).not.toHaveTextContent("Status note");
  });

  it("shows the reason for a status only when there is one", () => {
    render(
      <RecordSection
        status="INACTIVE"
        statusDescription="Moved out of the programme area"
        created={null}
        updated={null}
      />
    );
    const section = screen.getByRole("region", { name: "Record" });
    expect(section).toHaveTextContent("Status noteMoved out of the programme area");
    expect(within(section).getByText("Inactive")).toBeInTheDocument();
    expect(section).toHaveTextContent("Created—");
  });

  it("passes already-masked notes through untouched", () => {
    render(
      <RecordSection
        status="ACTIVE"
        notes={[["Outcome notes", <span key="x">•••••••• plan</span>]]}
      />
    );
    expect(screen.getByText("•••••••• plan")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reveal|hide/i })).not.toBeInTheDocument();
  });
});

describe("record status badge", () => {
  it("words the status in plain case", () => {
    render(<RecordStatusBadge status="DISABLED" />);
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });
});
