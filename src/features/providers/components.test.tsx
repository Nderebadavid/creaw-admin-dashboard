import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/providers",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("./actions", () => ({
  createProviderAction: vi.fn(async () => ({ success: true, message: "ok", resultCode: 201 })),
  updateProviderAction: vi.fn(async () => ({ success: true, message: "ok", resultCode: 200 })),
  setProviderActiveAction: vi.fn(async () => ({ success: true, message: "ok", resultCode: 200 })),
  revealProviderContactAction: vi.fn(),
}));
vi.mock("@/components/portal/data-actions", () => ({ auditedExportAction: vi.fn() }));
import { permittedNavigation } from "@/components/portal/navigation";
import { ProviderRegister } from "./components/provider-register";
import type { ProviderDirectory, WorkloadGroup } from "./model";

afterEach(cleanup);
const none: WorkloadGroup = { count: 0, recent: [] };
const directory: ProviderDirectory = {
  institutions: [{ id: 1, name: "Nairobi Women's Hospital" }],
  providers: [
    {
      id: 1,
      name: "Faith Kimani",
      firstName: "Faith",
      middleName: null,
      lastName: "Kimani",
      type: "counsellor",
      service: "Trauma counselling",
      institutionId: 1,
      institution: "Nairobi Women's Hospital",
      phone: "••••• ••0 221",
      email: null,
      notes: null,
      active: true,
      linkedWork: 3,
      workload: {
        sessions: {
          count: 1,
          recent: [{ id: 3, date: "2026-08-20", label: "Facility referral day", pillar: "SRHR" }],
        },
        counselling: {
          count: 2,
          recent: [
            { id: 11, date: "2026-09-01", label: "Counselling session" },
            { id: 12, date: "2026-09-08", label: "Counselling session" },
          ],
        },
        trainees: none,
        cases: none,
      },
    },
    {
      id: 2,
      name: "Judy Muthoni",
      firstName: "Judy",
      middleName: null,
      lastName: "Muthoni",
      type: "advocate",
      service: null,
      institutionId: null,
      institution: "Independent",
      phone: null,
      email: null,
      notes: null,
      active: false,
      linkedWork: 0,
      workload: { sessions: none, counselling: none, trainees: none, cases: none },
    },
  ],
};
const all = { manage: true, reveal: true, export: true };

describe("provider directory", () => {
  it("lists providers with the directory columns and filters", () => {
    render(<ProviderRegister directory={directory} can={all} />);
    for (const heading of ["Name", "Type", "Service", "Institution", "Linked work", "Status"])
      expect(screen.getByRole("columnheader", { name: new RegExp(heading) })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Inactive" }));
    expect(screen.queryByRole("button", { name: "Open Faith Kimani" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Judy Muthoni" })).toBeInTheDocument();
  });

  it("opens the drawer with masked contacts and linked work", () => {
    render(<ProviderRegister directory={directory} can={all} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Faith Kimani" }));
    const drawer = screen.getByRole("dialog");
    expect(drawer).toHaveTextContent("External provider");
    expect(drawer).toHaveTextContent("Counsellor · Nairobi Women's Hospital");
    expect(within(drawer).getByRole("button", { name: /Reveal phone/i })).toBeEnabled();
    fireEvent.click(within(drawer).getByRole("tab", { name: /Linked work/ }));
    expect(drawer).toHaveTextContent("Facility referral day");
  });

  it("never pre-fills masked contacts when editing", () => {
    render(<ProviderRegister directory={directory} can={all} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Faith Kimani" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Edit" }));
    const form = screen.getByRole("dialog", { name: /Edit provider/ });
    expect(within(form).getByLabelText("Phone")).toHaveValue("");
    expect(within(form).getAllByText("Leave blank to keep the current value").length).toBe(2);
  });

  it("confirms before deactivating", () => {
    render(<ProviderRegister directory={directory} can={all} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Faith Kimani" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Deactivate" }));
    expect(screen.getByRole("dialog", { name: /Deactivate provider/ })).toHaveTextContent(
      "Faith Kimani will no longer appear in pickers. Records already linked to them keep their name."
    );
  });

  it("hides management controls without permission", () => {
    render(
      <ProviderRegister
        directory={directory}
        can={{ manage: false, reveal: false, export: false }}
      />
    );
    expect(screen.queryByRole("button", { name: "Add provider" })).not.toBeInTheDocument();
  });
});

describe("provider navigation", () => {
  const hrefs = (permissionCode: string, pillarId: number | null = null) =>
    permittedNavigation([{ permissionCode, pillarId }]).flatMap((group) =>
      group.items.map((item) => item.href)
    );
  it("shows Providers only with a platform-wide PROVIDER_MANAGE grant", () => {
    expect(hrefs("PROVIDER_MANAGE")).toContain("/admin/providers");
    expect(hrefs("USER_MANAGE")).not.toContain("/admin/providers");
    expect(hrefs("PROVIDER_MANAGE", 2)).not.toContain("/admin/providers");
  });
});
