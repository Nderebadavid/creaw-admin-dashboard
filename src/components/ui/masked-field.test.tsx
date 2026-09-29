import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MaskedField } from "./masked-field";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("starts masked and only obtains the value through the audited action", async () => {
  const revealAction = vi.fn().mockResolvedValue({ success: true, value: "12345678" });
  const storage = vi.spyOn(Storage.prototype, "setItem");
  render(<MaskedField label="ID number" maskedValue="••••5678" revealAction={revealAction} />);
  expect(screen.queryByText("12345678")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reveal ID number" }));
  expect(await screen.findByText("12345678")).toBeInTheDocument();
  expect(revealAction).toHaveBeenCalledOnce();
  expect(storage).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Hide ID number" }));
  expect(screen.queryByText("12345678")).not.toBeInTheDocument();
});
it("retains masking when reveal is denied", async () => {
  render(
    <MaskedField
      label="Phone"
      maskedValue="••••1234"
      revealAction={async () => ({ success: false, error: "Permission denied" })}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Reveal Phone" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Permission denied");
  expect(screen.getByText("••••1234")).toBeInTheDocument();
});
it("does not carry a revealed field into another record", async () => {
  const view = render(
    <MaskedField
      label="Phone"
      maskedValue="••••1234"
      revealAction={async () => ({ success: true, value: "55551234" })}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Reveal Phone" }));
  expect(await screen.findByText("55551234")).toBeInTheDocument();
  view.rerender(
    <MaskedField
      label="Phone"
      maskedValue="••••4321"
      revealAction={async () => ({ success: true, value: "55554321" })}
    />
  );
  expect(screen.queryByText("55551234")).not.toBeInTheDocument();
  expect(screen.getByText("••••4321")).toBeInTheDocument();
});
