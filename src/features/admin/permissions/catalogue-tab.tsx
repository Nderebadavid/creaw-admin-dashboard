"use client";
import { useClientPaging } from "@/components/data-table/use-client-paging";
import { useClientSort } from "@/components/data-table/use-client-sort";
import { ariaSort, SortHeader } from "@/components/data-table/sort-header";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/data-table/pagination";
import type { PermissionView, RoleView } from "../api";

/** Searchable, paginated list of every permission and the roles that hold it. */
export function CatalogueTab({
  roles,
  permissions,
  hasGrant,
  canManagePermissions,
  onNewPermission,
}: {
  roles: RoleView[];
  permissions: PermissionView[];
  hasGrant: (role: RoleView, permission: PermissionView) => boolean;
  canManagePermissions: boolean;
  onNewPermission: () => void;
}) {
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");

  const modules = [...new Set(permissions.map((permission) => permission.module))].sort();
  const filtered = permissions.filter(
    (permission) =>
      (!moduleFilter || permission.module === moduleFilter) &&
      `${permission.name} ${permission.code} ${permission.description ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase())
  );
  const rolesWith = (permission: PermissionView) =>
    roles.filter((role) => hasGrant(role, permission));
  const columns = [
    { id: "permission", label: "Permission", sortValue: (row: PermissionView) => row.name },
    { id: "module", label: "Module", sortValue: (row: PermissionView) => row.module },
    {
      id: "description",
      label: "Description",
      sortValue: (row: PermissionView) => row.description,
    },
    {
      id: "roles",
      label: "Roles",
      sortValue: (row: PermissionView) =>
        rolesWith(row)
          .map((role) => role.name)
          .join(", "),
    },
  ];
  const { rows: sorted, sorting } = useClientSort(filtered, columns);
  const { pageRows: visible, pager, resetPage } = useClientPaging(sorted);

  return (
    <section className="rounded-2xl border border-creaw-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-creaw-divider p-5">
        <div>
          <h2 className="font-heading text-xl font-bold">Permission catalogue</h2>
          <p className="text-sm text-creaw-faint">
            The smallest units of access, grouped by module.
          </p>
        </div>
        <Button disabled={!canManagePermissions} onClick={onNewPermission}>
          <Plus size={16} />
          New permission
        </Button>
      </div>
      <div className="flex flex-wrap gap-3 p-4">
        <label className="flex min-w-52 flex-1 items-center gap-2 rounded-lg border bg-creaw-canvas px-3 py-2">
          <Search size={16} aria-hidden />
          <span className="sr-only">Search permission catalogue</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              resetPage();
            }}
            placeholder="Search code, name or description"
            className="min-w-0 w-full bg-transparent text-sm outline-none"
          />
        </label>
        <label className="text-sm">
          Module
          <select
            value={moduleFilter}
            onChange={(event) => {
              setModuleFilter(event.target.value);
              resetPage();
            }}
            className="ml-2 rounded-lg border bg-white p-2"
          >
            <option value="">All modules</option>
            {modules.map((module) => (
              <option key={module}>{module}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[740px] text-left text-sm">
          <thead className="bg-creaw-surface text-xs text-creaw-body">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={ariaSort(sorting.sort, column.id)}
                  className="p-3"
                >
                  <SortHeader
                    id={column.id}
                    sort={sorting.sort}
                    onSortChange={(sort) => {
                      sorting.onSortChange(sort);
                      resetPage();
                    }}
                  >
                    {column.label}
                  </SortHeader>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((permission) => (
              <tr key={permission.id} className="border-t border-creaw-divider">
                <td className="p-3">
                  <strong>{permission.name}</strong>
                  <span className="block font-mono text-xs text-creaw-faint">
                    {permission.code}
                  </span>
                </td>
                <td className="p-3">{permission.module}</td>
                <td className="p-3 text-creaw-body">{permission.description ?? "—"}</td>
                <td className="p-3">
                  {rolesWith(permission).map((role) => (
                    <span
                      key={role.id}
                      className="mr-1 inline-block rounded-md bg-creaw-canvas px-2 py-1 text-xs"
                    >
                      {role.name}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="p-8 text-center text-sm text-creaw-faint">No permissions match.</p>
        )}
      </div>
      <div className="px-4">
        <Pagination {...pager} />
      </div>
    </section>
  );
}
