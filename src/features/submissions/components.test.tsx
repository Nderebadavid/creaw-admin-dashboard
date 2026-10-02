import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
vi.mock("server-only", () => ({}));
vi.mock("./actions", () => ({
  reviewSubmissionAction: vi.fn(),
  viewSubmissionPhotoAction: vi.fn(),
  listSubmissionsAction: vi.fn(),
}));
vi.mock("@/components/portal/data-actions", () => ({ auditedExportAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { SubmissionsContent } from "./components";
import {
  listSubmissionsAction,
  reviewSubmissionAction,
  viewSubmissionPhotoAction,
} from "./actions";
import type { SubmissionList, SubmissionRow } from "./api";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const rows: SubmissionRow[] = [
  {
    id: 1,
    title: "Facility referral day",
    type: "Outreach",
    pillarId: 3,
    pillar: "SRHR",
    captured: "2026-09-27",
    source: "mobile",
    status: "Pending review",
    flag: null,
    photos: [{ id: 41, name: "group photo" }],
  },
  {
    id: 2,
    title: "Court attendance",
    type: "Case update",
    pillarId: 1,
    pillar: "VAWG",
    captured: "2026-09-26",
    source: "mobile",
    status: "Flagged",
    flag: "Check photo",
  },
];

/** A page as the API returns it, with the count of each review status. */
const listOf = (items: SubmissionRow[], total = items.length): SubmissionList => ({
  items,
  page: 1,
  pageSize: 12,
  totalItems: total,
  totalPages: Math.max(1, Math.ceil(total / 12)),
  facets: { review_status: { "Pending review": 1, Flagged: 1 } },
});
const only = (status: string) => rows.filter((row) => row.status === status);

describe("field submissions screen", () => {
  it("asks the API for a status and keeps review permission visible", async () => {
    vi.mocked(listSubmissionsAction).mockResolvedValue({
      success: true,
      message: "OK",
      data: listOf(only("Flagged")),
    });
    render(<SubmissionsContent initial={listOf(rows)} />);
    expect(screen.getByText("Facility referral day")).toBeInTheDocument();
    // Tab counts come from the API's facets, not from the rows on screen.
    expect(screen.getByRole("button", { name: /Flagged/ })).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: /Flagged/ }));
    await waitFor(() =>
      expect(listSubmissionsAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "Flagged", page: 1 })
      )
    );
    await waitFor(() =>
      expect(screen.queryByText("Facility referral day")).not.toBeInTheDocument()
    );
    expect(screen.getByText("Court attendance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review Court attendance/ })).toBeDisabled();
  });
  it("enables review only for records in the scoped review grant", () => {
    render(<SubmissionsContent initial={listOf(rows)} reviewablePillarIds={[1]} />);
    expect(screen.getByRole("button", { name: /Review Court attendance/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Review Facility referral day/ })).toBeDisabled();
  });
  it("offers export only when every card shown is in a pillar the user may export", async () => {
    vi.mocked(listSubmissionsAction).mockResolvedValue({
      success: true,
      message: "OK",
      data: listOf(only("Pending review")),
    });
    render(<SubmissionsContent initial={listOf(rows)} canExport exportablePillarIds={[3]} />);
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
    // The design has status tabs and no search box; the Pending tab shows only the exportable card.
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Pending review/ }));
    expect(await screen.findByRole("button", { name: "Export CSV" })).toBeInTheDocument();
  });

  it("lays out cards and page actions like the design", () => {
    render(
      <SubmissionsContent
        heading={{
          title: "Field submissions",
          section: "Overview",
          description: "Data captured on the MERL mobile app, waiting for verification",
        }}
        initial={listOf(rows)}
        reviewablePillarIds={[1, 3]}
        canExport
      />
    );
    const header = screen
      .getByRole("heading", { level: 1, name: "Field submissions" })
      .closest("[data-page-heading]") as HTMLElement;
    // Page headers carry no buttons; a list\'s actions sit beside the list.
    expect(within(header).queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeInTheDocument();
    expect(screen.getByText("photo · outreach")).toBeInTheDocument();
    expect(screen.getByText("SRHR · Outreach")).toBeInTheDocument();
  });

  it("confirms before approving straight from a card", async () => {
    vi.mocked(reviewSubmissionAction).mockResolvedValue({
      success: true,
      message: "Submission approved.",
    });
    render(<SubmissionsContent initial={listOf(rows)} reviewablePillarIds={[1, 3]} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve Facility referral day" }));
    const dialog = screen.getByRole("dialog", { name: "Approve submission?" });
    expect(dialog).toHaveTextContent(
      "Approve “Facility referral day”? The data is merged into the linked record."
    );
    expect(reviewSubmissionAction).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(reviewSubmissionAction).toHaveBeenCalledWith(1, "approve"));
  });

  it("opens a submission's photo in the document viewer, as in the design", async () => {
    vi.mocked(viewSubmissionPhotoAction).mockResolvedValue({
      success: true,
      message: "OK",
      document: {
        id: 41,
        name: "group photo",
        documentType: "group_photo",
        fileUrl: "mock://documents/field/m1/1.jpg",
        linkedRecord: "Facility referral day",
        uploadedAt: "2026-09-27",
        source: "Mobile app",
      },
    });
    render(<SubmissionsContent initial={listOf(rows)} reviewablePillarIds={[1, 3]} />);
    // Each card counts its photos, as in the design.
    const card = screen.getByText("Facility referral day").closest("article") as HTMLElement;
    expect(within(card).getByText("photos, captured on mobile").parentElement).toHaveTextContent(
      "1"
    );
    fireEvent.click(screen.getByRole("button", { name: "Review Facility referral day" }));
    fireEvent.click(screen.getByRole("button", { name: "Open photo: group photo" }));
    await waitFor(() => expect(viewSubmissionPhotoAction).toHaveBeenCalledWith(1, 41));
    const viewer = await screen.findByRole("dialog", { name: "Group photo" });
    expect(viewer).toHaveTextContent("Photo (JPG)");
    expect(viewer).toHaveTextContent("Mobile app");
    expect(viewer).toHaveTextContent("Facility referral day");
  });
});
