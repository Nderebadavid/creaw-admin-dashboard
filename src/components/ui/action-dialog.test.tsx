import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionDialog } from "./action-dialog";

function renderDialog(busy: boolean, onClose = vi.fn()) {
  render(
    <ActionDialog
      open
      busy={busy}
      onClose={onClose}
      title="Edit"
      description="Details"
      error="Try again"
    >
      <button type="button">Save</button>
    </ActionDialog>
  );
  return onClose;
}

describe("ActionDialog", () => {
  it("shows the title, description and error", () => {
    renderDialog(false);
    expect(screen.getByRole("dialog", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Try again");
  });

  it("closes on Escape when idle", () => {
    const onClose = renderDialog(false);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("stays open on Escape while a save is in flight", () => {
    const onClose = renderDialog(true);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
