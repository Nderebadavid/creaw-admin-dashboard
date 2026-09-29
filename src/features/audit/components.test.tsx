import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
vi.mock("./actions", () => ({ listAuditAction: vi.fn(), exportAuditAction: vi.fn() }));
import { AuditContent } from "./components";

describe("audit screen", () => {
  it("shows source, module, action and date filters and a masked record viewer", () => {
    render(<AuditContent initial={{ page: 1, pageSize: 25, totalItems: 1, totalPages: 1, items: [{ id: 1, entity_type: "user", entity_id: 2, action: "UPDATE", source: "HTTP", performed_by: 1, performed_by_name: "Judy Mwangi", performed_at: "2026-09-29T10:00:00Z", endpoint: "/admin/users/:id", event_name: null, input_payload: "{\"email\":\"[REDACTED]\"}", previous_state: null, new_state: null }] }} canExport />);
    expect(screen.getByLabelText("Source")).toBeInTheDocument();
    expect(screen.getByLabelText("Module")).toBeInTheDocument();
    expect(screen.getByLabelText("Action")).toBeInTheDocument();
    expect(screen.getByLabelText("From date")).toBeInTheDocument();
    expect(screen.getAllByText("Judy Mwangi").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument();
  });
});
