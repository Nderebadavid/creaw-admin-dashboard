import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
vi.mock("./actions", () => ({ listAuditAction: vi.fn(), exportAuditAction: vi.fn() }));
import { AuditContent } from "./components";

afterEach(cleanup);

describe("audit screen", () => {
  it("shows source, module, action and date filters and a masked record viewer", () => {
    render(
      <AuditContent
        initial={{
          page: 1,
          pageSize: 25,
          totalItems: 1,
          totalPages: 1,
          items: [
            {
              id: 1,
              entity_type: "user",
              entity_id: 2,
              action: "UPDATE",
              source: "HTTP",
              performed_by: 1,
              performed_by_name: "Judy Mwangi",
              performed_at: "2026-09-29T10:00:00Z",
              endpoint: "/admin/users/:id",
              event_name: null,
              input_payload: '{"email":"[REDACTED]"}',
              previous_state: null,
              new_state: null,
            },
          ],
        }}
        canExport
      />
    );
    expect(screen.getByLabelText("Source")).toBeInTheDocument();
    expect(screen.getByLabelText("Module")).toBeInTheDocument();
    expect(screen.getByLabelText("Action")).toBeInTheDocument();
    expect(screen.getByLabelText("From date")).toBeInTheDocument();
    expect(screen.getAllByText("Judy Mwangi").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument();
  });

  it("expands an entry in place and keeps export beside the heading", () => {
    render(
      <AuditContent
        heading={{
          title: "Audit log",
          section: "Reporting",
          description: "Every create, edit, reveal, upload and export — portal and mobile",
        }}
        initial={{
          page: 1,
          pageSize: 25,
          totalItems: 1,
          totalPages: 1,
          items: [
            {
              id: 7,
              entity_type: "participant",
              entity_id: 10,
              action: "REVEAL",
              source: "HTTP",
              performed_by: 1,
              performed_by_name: "Judy Mwangi",
              performed_at: "2026-09-29T10:00:00Z",
              endpoint: "/participants/:id",
              event_name: null,
              input_payload: '{"field":"id_number"}',
              previous_state: null,
              new_state: null,
            },
          ],
        }}
        canExport
      />
    );
    const header = screen
      .getByRole("heading", { level: 1, name: "Audit log" })
      .closest("[data-page-heading]") as HTMLElement;
    expect(within(header).getByRole("button", { name: /export csv/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kafka (system)" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.queryByText("input_payload")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("cell", { name: "Judy Mwangi" }));
    expect(screen.getByText("input_payload")).toBeInTheDocument();
    expect(screen.getByText(/"field": "id_number"/)).toBeInTheDocument();
    expect(screen.getByText(/\/participants\/:id/)).toBeInTheDocument();
  });
});
