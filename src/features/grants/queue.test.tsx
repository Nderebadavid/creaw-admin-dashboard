import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("./actions", () => ({
  listGrantsAction: vi.fn(),
  exportGrantsAction: vi.fn(),
}));
import { GrantsContent } from "./components";

afterEach(() => {
  cleanup();
  push.mockClear();
});

const row = {
  id: 2,
  applicant: "Rehema Karisa",
  project: "WEE business grants",
  pillarId: 2,
  status: "PREPARED",
  requestedAmount: "KES 120,000",
  grantType: "one_off",
  createdAt: "2026-09-01T00:00:00.000Z",
};

function renderQueue() {
  render(
    <GrantsContent
      heading={{
        title: "Grants",
        section: "Records",
        description: "WEE business grants and WRO sub-grants",
      }}
      initial={{ items: [row], page: 1, pageSize: 25, totalItems: 1, totalPages: 1 }}
      pillars={[{ id: 2, name: "WEE" }]}
      canExport
    />
  );
}

it("frames applications in the design's queue card", () => {
  renderQueue();
  const header = screen
    .getByRole("heading", { level: 1, name: "Grants" })
    .closest("[data-page-heading]") as HTMLElement;
  // Page headers carry no buttons; a list\'s actions sit beside the list.
  expect(within(header).queryAllByRole("button")).toHaveLength(0);
  expect(screen.getByRole("button", { name: /Export CSV/ })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Applications queue" })).toBeInTheDocument();
  expect(screen.getByText("Click an application to work its sign-off chain")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Prepared" })).toHaveAttribute("aria-pressed", "false");
});

it("opens an application's sign-off page from its row", () => {
  renderQueue();
  fireEvent.click(screen.getByText("Rehema Karisa"));
  expect(push).toHaveBeenCalledWith("/grants/2");
});
