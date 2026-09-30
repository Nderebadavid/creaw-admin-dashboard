"use client";
import { useClientPaging } from "@/components/data-table/use-client-paging";
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
  const { pageRows: visible, pager, resetPage } = useClientPaging(filtered);

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
              <th className="p-3">Permission</th>
              <th className="p-3">Module</th>
              <th className="p-3">Description</th>
              <th className="p-3">Roles</th>
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
                  {roles
                    .filter((role) => hasGrant(role, permission))
                    .map((role) => (
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
