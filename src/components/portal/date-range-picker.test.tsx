import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DateRangePicker, defaultRange, formatRangeDate } from "./date-range-picker";

afterEach(cleanup);
const today = new Date("2026-09-27T09:00:00");

describe("date range helpers", () => {
  it("defaults to the current quarter to date", () => {
    expect(defaultRange(today)).toEqual({ from: "2026-07-01", to: "2026-09-27" });
  });

  it("formats dates as day, short month and year", () => {
    expect(formatRangeDate("2026-09-07")).toBe("07 Sep 2026");
  });
});

describe("DateRangePicker", () => {
  function setup() {
    const onChange = vi.fn();
    render(<DateRangePicker value={defaultRange(today)} onChange={onChange} today={today} />);
    fireEvent.click(screen.getByRole("button", { name: /Date range/ }));
    return onChange;
  }

  it("shows the applied range on its button", () => {
    render(<DateRangePicker value={defaultRange(today)} onChange={vi.fn()} today={today} />);
    expect(screen.getByRole("button", { name: /Date range/ })).toHaveTextContent(
      "01 Jul 2026 – 27 Sep 2026"
    );
  });

  it("applies a preset only when Apply is pressed", () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
    expect(screen.getByText("7 days · filters records by their created date")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onChange).toHaveBeenCalledWith({ from: "2026-09-21", to: "2026-09-27" });
  });

  it("refuses an end date before the start date", () => {
    const onChange = setup();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-30" } });
    expect(screen.getByText(/End date is before start date/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("discards edits on Cancel", () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole("button", { name: "Last year" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  it("will not apply a range with a cleared date", () => {
    const onChange = setup();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
