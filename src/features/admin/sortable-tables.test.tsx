import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("./lookup-actions", () => ({
  createLookupAction: vi.fn(),
  updateLookupAction: vi.fn(),
  setLookupActiveAction: vi.fn(),
  exportLookupAction: vi.fn(),
}));
import type { PermissionView, RoleView } from "./api";
import { LookupContent } from "./lookup-components";
import { CatalogueTab } from "./permissions/catalogue-tab";

afterEach(cleanup);

/** The text of the first cell of each body row, in display order. */
const firstColumn = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.querySelector("td")!.textContent);

describe("lookup table sorting", () => {
  it("sorts by name, by the parent's label and by the active switch", () => {
    render(
      <LookupContent
        table="sub_county"
        rows={[
          { id: 1, name: "Westlands", county_id: 2, status: "ACTIVE", is_deleted: false },
          { id: 2, name: "Bondeni", county_id: 1, status: "ACTIVE", is_deleted: true },
          { id: 3, name: "Kibra", county_id: 2, status: "ACTIVE", is_deleted: false },
        ]}
        parent={null}
        counties={[
          { id: 1, name: "Nakuru" },
          { id: 2, name: "Nairobi" },
        ]}
        subCounties={[]}
        pillars={[]}
        canViewAudit={false}
      />
    );
    for (const name of ["Sub-county", "County", "Active"])
      expect(screen.getByRole("columnheader", { name })).toHaveAttribute("aria-sort", "none");
    fireEvent.click(screen.getByRole("button", { name: "Sub-county" }));
    expect(firstColumn()).toEqual(["Bondeni", "Kibra", "Westlands"]);
    // County sorts by the county's name (Nairobi, Nakuru), not by its id.
    fireEvent.click(screen.getByRole("button", { name: "County" }));
    expect(firstColumn().at(-1)).toBe("Bondeni");
    fireEvent.click(screen.getByRole("button", { name: "Active" }));
    fireEvent.click(screen.getByRole("button", { name: "Active" }));
    expect(firstColumn()[0]).toBe("Bondeni");
    expect(screen.getByRole("columnheader", { name: "Active" })).toHaveAttribute(
      "aria-sort",
      "descending"
    );
  });
});

describe("permission catalogue sorting", () => {
  it("sorts by every column, including the roles that hold a permission", () => {
    const permission = (id: number, name: string, module: string) =>
      ({ id, name, code: name.toUpperCase(), module, description: null }) as PermissionView;
    const roles = [
      { id: 1, name: "Viewer" },
      { id: 2, name: "Admin" },
    ] as RoleView[];
    render(
      <CatalogueTab
        roles={roles}
        permissions={[
          permission(1, "Export", "Reports"),
          permission(2, "Approve", "Grants"),
          permission(3, "View", "Audit"),
        ]}
        // Approve: Admin. Export: Viewer. View: nobody.
        hasGrant={(role, item) =>
          (item.id === 2 && role.id === 2) || (item.id === 1 && role.id === 1)
        }
        canManagePermissions={false}
        onNewPermission={() => {}}
      />
    );
    const names = () => firstColumn().map((text) => text!.replace(/[A-Z]+$/, ""));
    fireEvent.click(screen.getByRole("button", { name: "Permission" }));
    expect(names()).toEqual(["Approve", "Export", "View"]);
    fireEvent.click(screen.getByRole("button", { name: "Module" }));
    expect(names()).toEqual(["View", "Approve", "Export"]);
    fireEvent.click(screen.getByRole("button", { name: "Roles" }));
    // Admin, then Viewer; a permission no role holds goes last.
    expect(names()).toEqual(["Approve", "Export", "View"]);
    for (const name of ["Permission", "Module", "Description", "Roles"])
      expect(screen.getByRole("columnheader", { name })).toHaveAttribute("aria-sort");
  });
});
