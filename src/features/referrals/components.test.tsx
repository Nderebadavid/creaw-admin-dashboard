import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
vi.mock("./actions", () => ({
  createReferralAction: vi.fn(),
  editReferralAction: vi.fn(),
  exportReferralsAction: vi.fn(),
  listReferralsAction: vi.fn(),
  respondReferralAction: vi.fn(),
  withdrawReferralAction: vi.fn(),
}));
import { createReferralAction, listReferralsAction, respondReferralAction } from "./actions";
import { ReferralsContent } from "./components";
import type { ReferralView } from "./api";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("announces a decision failure inside the active dialog", async () => {
  vi.mocked(respondReferralAction).mockResolvedValue({
    resultCode: 422,
    success: false,
    message: "Referral already decided",
    data: null,
  });
  const referral: ReferralView = {
    id: 4,
    enrollmentId: 7,
    participantId: 6,
    participant: "••••a ••••med",
    fromPillarId: 1,
    toPillarId: 2,
    fromPillar: "VAWG",
    toPillar: "WEE",
    destinationName: "WEE",
    external: false,
    reason: "Business support",
    source: "Not recorded",
    date: "2026-09-27T00:00:00.000Z",
    ageDays: 2,
    status: "NEW",
    canRespond: true,
    respondDisabledReason: null,
    canEdit: false,
    canWithdraw: false,
  };
  render(
    <ReferralsContent
      initial={{ items: [referral], page: 1, pageSize: 25, totalItems: 1, totalPages: 1 }}
      pillars={[
        { id: 1, name: "VAWG" },
        { id: 2, name: "WEE" },
      ]}
      origins={[]}
      grants={[{ permissionCode: "REFERRAL_VIEW", pillarId: 2 }]}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Decide" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Save response" }));
  await waitFor(() =>
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Referral already decided")
  );
});

it("submits an external institution destination from the referral dialog", async () => {
  vi.mocked(createReferralAction).mockResolvedValue({
    resultCode: 201,
    success: true,
    message: "OK",
    data: null,
  });
  vi.mocked(listReferralsAction).mockResolvedValue({
    resultCode: 200,
    success: true,
    message: "OK",
    data: { items: [], page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
  });
  render(
    <ReferralsContent
      initial={{ items: [], page: 1, pageSize: 25, totalItems: 0, totalPages: 0 }}
      pillars={[
        { id: 1, name: "VAWG" },
        { id: 2, name: "WEE" },
      ]}
      origins={[
        { enrollmentId: 1, pillarId: 1, participant: "••••h ••••eri", category: "Legal aid" },
      ]}
      catalog={{
        internalPillarIds: [1, 2],
        partnerInstitutions: [{ id: 6, name: "Nairobi Women's Shelter" }],
      }}
      grants={[{ permissionCode: "REFERRAL_CREATE", pillarId: 1 }]}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "New referral" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("combobox", { name: "Destination type" }), {
    target: { value: "external" },
  });
  fireEvent.change(within(dialog).getByRole("combobox", { name: "Responsible pillar" }), {
    target: { value: "1" },
  });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Reason" }), {
    target: { value: "Shelter placement" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Send referral" }));
  await waitFor(() =>
    expect(createReferralAction).toHaveBeenCalledWith(
      expect.objectContaining({ partnerInstitutionId: 6, toPillarId: 1 })
    )
  );
});

it("shows the external destination name in both the queue and decision dialog", () => {
  const referral: ReferralView = {
    id: 1,
    enrollmentId: 1,
    participantId: 1,
    participant: "••••h ••••eri",
    fromPillarId: 1,
    toPillarId: 1,
    fromPillar: "VAWG",
    toPillar: "VAWG",
    destinationName: "Nairobi Women's Shelter",
    external: true,
    reason: "Shelter placement",
    source: "Not recorded",
    date: "2026-09-27T00:00:00.000Z",
    ageDays: 2,
    status: "NEW",
    canRespond: true,
    respondDisabledReason: null,
    canEdit: false,
    canWithdraw: false,
  };
  render(
    <ReferralsContent
      initial={{ items: [referral], page: 1, pageSize: 25, totalItems: 1, totalPages: 1 }}
      pillars={[{ id: 1, name: "VAWG" }]}
      origins={[]}
      grants={[{ permissionCode: "REFERRAL_VIEW", pillarId: 1 }]}
    />
  );
  expect(screen.getAllByText("Nairobi Women's Shelter").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Decide" }));
  expect(
    within(screen.getByRole("dialog")).getByText(/Nairobi Women's Shelter/)
  ).toBeInTheDocument();
});
