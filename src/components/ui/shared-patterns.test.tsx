import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DocumentPanel } from "./document-panel";
import { ExportButton } from "./export-button";
import { ModalForm } from "./modal-form";
import { ProgressChart } from "./progress-chart";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("distinguishes present documents from missing requirements", () => {
  render(
    <DocumentPanel
      documents={[{ id: 1, name: "Business plan", requirement: "Plan" }]}
      requirements={["Plan", "ID copy"]}
    />
  );
  expect(screen.getByText("Business plan")).toBeInTheDocument();
  expect(screen.getByText("Missing: ID copy")).toBeInTheDocument();
  expect(screen.queryByText("Missing: Plan")).not.toBeInTheDocument();
});
it("awaits the audited filtered export before starting a download", async () => {
  const events: string[] = [];
  const exportAction = vi.fn(async () => {
    events.push("audit");
    return { success: true as const, filename: "participants.csv", content: "id\n12" };
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => {
      events.push("download");
      return "blob:export";
    }),
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<ExportButton exportAction={exportAction} />);
  fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
  await waitFor(() => expect(events).toEqual(["audit", "download"]));
  expect(exportAction).toHaveBeenCalledOnce();
});
it("does not download when the audited export fails", async () => {
  const create = vi.spyOn(URL, "createObjectURL");
  render(<ExportButton exportAction={async () => ({ success: false, error: "Export denied" })} />);
  fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Export denied");
  expect(create).not.toHaveBeenCalled();
});
it("keeps failed modal forms open and displays the server error", async () => {
  const onOpenChange = vi.fn();
  render(
    <ModalForm
      open
      title="Add record"
      description="Enter the record details."
      onOpenChange={onOpenChange}
      action={async () => ({ success: false, error: "A record already exists" })}
    >
      <label>
        Name
        <input name="name" defaultValue="Sample" />
      </label>
    </ModalForm>
  );
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("A record already exists");
  expect(onOpenChange).not.toHaveBeenCalled();
});
it("bounds long modal forms to the viewport and keeps actions outside the keyboard-scrollable fields", () => {
  render(
    <ModalForm
      open
      title="Long record"
      description="Complete the fields."
      onOpenChange={() => {}}
      action={async () => ({ success: true })}
    >
      {Array.from({ length: 20 }, (_, index) => (
        <label key={index}>
          Field {index + 1}
          <input name={`field-${index}`} />
        </label>
      ))}
    </ModalForm>
  );
  const dialog = screen.getByRole("dialog", { name: "Long record" });
  const fields = screen.getByRole("region", { name: "Long record fields" });
  expect(dialog).toHaveClass("max-h-[calc(100dvh-3rem)]", "overflow-hidden");
  expect(fields).toHaveClass("min-h-0", "overflow-y-auto");
  expect(fields).toHaveAttribute("tabindex", "0");
  expect(fields).toContainElement(screen.getByLabelText("Field 20"));
  expect(dialog).toContainElement(screen.getByRole("button", { name: "Save" }));
  expect(fields).not.toContainElement(screen.getByRole("button", { name: "Save" }));
  expect(fields).not.toContainElement(screen.getByRole("button", { name: "Cancel" }));
});
it("exposes chart values to assistive technology", () => {
  render(
    <ProgressChart label="Quarterly reach" series={[{ label: "July", value: 12, target: 20 }]} />
  );
  expect(screen.getByRole("progressbar", { name: "July" })).toHaveAttribute("aria-valuenow", "12");
  expect(screen.getByText("12 / 20")).toBeInTheDocument();
});
