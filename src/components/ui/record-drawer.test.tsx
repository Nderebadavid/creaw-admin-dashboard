import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RecordDrawer } from "./record-drawer";

afterEach(cleanup);

function renderDrawer(onClose = vi.fn()) {
  render(
    <RecordDrawer
      open
      onClose={onClose}
      initials="FW"
      kind="Participant · VAWG"
      title="Faith Wanjiku"
      subtitle="Machakos · Mlolongo"
      status={<span>Active</span>}
      actions={<button type="button">Edit</button>}
      tabs={[
        { id: "overview", label: "Overview", content: <p>Overview body</p> },
        { id: "activity", label: "Activity", content: <p>Activity body</p> },
      ]}
    />
  );
  return onClose;
}

it("shows the record header, status and actions", () => {
  renderDrawer();
  const drawer = screen.getByRole("dialog", { name: "Faith Wanjiku" });
  expect(drawer).toHaveTextContent("Participant · VAWG");
  expect(drawer).toHaveTextContent("Machakos · Mlolongo");
  expect(drawer).toHaveTextContent("Active");
  expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
});

it("switches between tabs", () => {
  renderDrawer();
  expect(screen.getByText("Overview body")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Activity" }));
  expect(screen.getByRole("tab", { name: "Activity" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("Activity body")).toBeInTheDocument();
  expect(screen.queryByText("Overview body")).not.toBeInTheDocument();
});

it("closes from its close button", () => {
  const onClose = renderDrawer();
  fireEvent.click(screen.getByRole("button", { name: "Close record" }));
  expect(onClose).toHaveBeenCalled();
});
