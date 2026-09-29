import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
vi.mock("./actions", () => ({
  listParticipantsAction: vi.fn(), registerParticipantAction: vi.fn(), updateParticipantAction: vi.fn(),
  revealParticipantAction: vi.fn(), exportParticipantsAction: vi.fn(),
}));
import { registerParticipantAction } from "./actions";
import { ParticipantsContent } from "./components";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("announces registration failure inside the active dialog", async () => {
  vi.mocked(registerParticipantAction).mockResolvedValue({ resultCode: 422, success: false, message: "Duplicate participant", data: null });
  render(<ParticipantsContent initial={{ items: [], page: 1, pageSize: 25, totalItems: 0, totalPages: 0 }}
    catalog={{ pillars: [{ id: 1, name: "VAWG" }], counties: [], wards: [] }}
    grants={[{ permissionCode: "PARTICIPANT_EDIT", pillarId: 1 }]} />);
  fireEvent.click(screen.getByRole("button", { name: "Register participant" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox", { name: "First name" }), { target: { value: "Faith" } });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Last name" }), { target: { value: "Njeri" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Register participant" }));
  await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("Duplicate participant"));
});
