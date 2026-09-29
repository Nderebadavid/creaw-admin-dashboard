import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
vi.mock("./actions", () => ({ listGrantsAction: vi.fn(), advanceGrantAction: vi.fn(), recordDisbursementAction: vi.fn(), downloadGrantPackAction: vi.fn(), exportGrantsAction: vi.fn() }));
import { GrantDetailContent } from "./components";
describe("grant detail", () => {
  it("shows sign-off and masked disbursement values without enabling an unauthorized step", () => {
    render(<GrantDetailContent detail={{ id: 1, applicant: "Participant #3", project: "WEE", pillarId: 2, status: "REVIEWED", requestedAmount: "KES 50,000", grantType: "staggered", createdAt: "2026-09-01", notes: null, participantId: 3, organisationId: null, stage: 2, nextStatus: "APPROVED", award: { id: 1, amountAwarded: "••••", currency: "KES", lifecycle: "active" }, disbursements: [{ id: 1, amount: "••••", date: "2026-09-02", notes: null }], documents: [] }} canAdvance={false} canDisburse={false} canDownload={false} />);
    expect(screen.getByText("Sign-off chain")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve application/i })).toBeDisabled();
    expect(screen.queryByText("55000")).not.toBeInTheDocument();
  });
});
