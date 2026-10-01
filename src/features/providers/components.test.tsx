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
  loadProviderWorkloadAction: vi.fn(async () => ({ success: false, message: "", data: null })),
}));
vi.mock("@/components/portal/data-actions", () => ({ auditedExportAction: vi.fn() }));
import { permittedNavigation } from "@/components/portal/navigation";
import * as actions from "./actions";
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
      phone: "0711 900 221",
      email: null,
      notes: null,
      active: true,
      statusDescription: null,
      created: null,
      updated: null,
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
      statusDescription: null,
      created: null,
      updated: null,
      linkedWork: 0,
      workload: { sessions: none, counselling: none, trainees: none, cases: none },
    },
  ],
};
const all = { manage: true, export: true };

describe("provider directory", () => {
  it("lists providers with the directory columns and filters", () => {
    render(<ProviderRegister directory={directory} can={all} />);
    for (const heading of ["Name", "Type", "Service", "Institution", "Linked work", "Status"])
      expect(screen.getByRole("columnheader", { name: new RegExp(heading) })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Inactive" }));
    expect(screen.queryByRole("button", { name: "Open Faith Kimani" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Judy Muthoni" })).toBeInTheDocument();
  });

  it("opens the drawer with contacts and linked work", () => {
    render(<ProviderRegister directory={directory} can={all} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Faith Kimani" }));
    const drawer = screen.getByRole("dialog");
    expect(drawer).toHaveTextContent("External provider");
    expect(drawer).toHaveTextContent("Counsellor · Nairobi Women's Hospital");
    expect(drawer).toHaveTextContent("0711 900 221");
    expect(within(drawer).queryByRole("button", { name: /reveal|hide/i })).not.toBeInTheDocument();
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

  it("keeps an institution that is missing from the list selected when editing", () => {
    const orphaned: ProviderDirectory = {
      ...directory,
      institutions: [{ id: 7, name: "Other Clinic" }],
      providers: [
        { ...directory.providers[0], institutionId: 1, institution: "Unknown institution" },
      ],
    };
    render(<ProviderRegister directory={orphaned} can={all} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Faith Kimani" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Edit" }));
    const select = screen.getByLabelText("Affiliated institution") as HTMLSelectElement;
    expect(select.value).toBe("1");
    expect(select.selectedOptions[0].text).toBe("Unknown institution");
    expect([...select.options].map((o) => o.text)).toEqual([
      "None",
      "Unknown institution",
      "Other Clinic",
    ]);
  });

  it("shows a failed reactivate and blocks a second click while it runs", async () => {
    let finish: (value: { success: false; message: string; resultCode: number }) => void = () => {};
    vi.mocked(actions.setProviderActiveAction).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }) as never
    );
    render(<ProviderRegister directory={directory} can={all} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Judy Muthoni" }));
    const button = within(screen.getByRole("dialog")).getByRole("button", { name: "Reactivate" });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    finish({ success: false, message: "Provider is locked", resultCode: 409 });
    expect(await screen.findByText("Provider is locked")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(actions.setProviderActiveAction).toHaveBeenCalledTimes(1);
  });

  it("puts the deactivate buttons in the form footer, with a destructive confirm", () => {
    render(<ProviderRegister directory={directory} can={all} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Faith Kimani" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Deactivate" }));
    const dialog = screen.getByRole("dialog", { name: /Deactivate provider/ });
    const confirm = within(dialog).getByRole("button", { name: "Deactivate" });
    expect(confirm.parentElement!.parentElement!.tagName).toBe("FORM");
    expect(confirm.parentElement!.matches(":last-child")).toBe(true);
    expect(confirm.className).toContain("text-destructive");
  });

  it("names the middle name in the saved toast", async () => {
    render(<ProviderRegister directory={directory} can={all} />);
    fireEvent.click(screen.getByRole("button", { name: "Add provider" }));
    const form = screen.getByRole("dialog", { name: /Add provider/ });
    fireEvent.change(within(form).getByLabelText("First name"), { target: { value: "Grace" } });
    fireEvent.change(within(form).getByLabelText("Middle name"), { target: { value: "Njeri" } });
    fireEvent.change(within(form).getByLabelText("Last name"), { target: { value: "Wanjiru" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add provider" }));
    expect(await screen.findByText("Grace Njeri Wanjiru added")).toBeInTheDocument();
  });

  it("hides management controls without permission", () => {
    render(<ProviderRegister directory={directory} can={{ manage: false, export: false }} />);
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
