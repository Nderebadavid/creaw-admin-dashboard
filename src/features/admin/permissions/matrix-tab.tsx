"use client";
import { Fragment } from "react";
import type { PermissionView, RoleView } from "../api";

/** Full role × permission grid; each cell stages a grant or revocation. */
export function MatrixTab({
  roles,
  permissions,
  hasGrant,
  isUnsaved,
  onToggle,
  canManagePermissions,
}: {
  roles: RoleView[];
  permissions: PermissionView[];
  hasGrant: (role: RoleView, permission: PermissionView) => boolean;
  isUnsaved: (role: RoleView, permission: PermissionView) => boolean;
  onToggle: (role: RoleView, permission: PermissionView) => void;
  canManagePermissions: boolean;
}) {
  const modules = [...new Set(permissions.map((permission) => permission.module))].sort();

  return (
    <section className="rounded-2xl border border-creaw-line bg-white">
      <div className="p-5">
        <h2 className="font-heading text-xl font-bold">Role × permission matrix</h2>
        <p className="text-sm text-creaw-faint">
          Click any cell to grant or revoke. Changes are staged until you save.
        </p>
        <ul aria-label="Legend" className="mt-3 flex flex-wrap gap-4 text-xs text-creaw-body">
          <li className="flex items-center gap-1.5">
            <span className="flex size-5 items-center justify-center rounded-md bg-[#E3F3EA] text-[11px] font-bold text-[#1F7A4D]">
              ✓
            </span>
            Granted
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-5 rounded-md border border-creaw-line-strong bg-white" />
            Not granted
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-5 rounded-md border-2 border-[#E0822F] bg-white" />
            Unsaved
          </li>
        </ul>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-creaw-surface">
            <tr>
              <th className="sticky left-0 z-10 min-w-56 border-b bg-creaw-surface p-3 text-left">
                Permission
              </th>
              {roles.map((role) => (
                <th key={role.id} className="min-w-24 border-b p-2 text-center text-xs">
                  {role.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((module) => (
              <Fragment key={module}>
                <tr className="bg-[#FFFBF7]">
                  <th className="sticky left-0 bg-[#FFFBF7] p-3 text-left font-heading font-bold text-creaw-orange">
                    {module}
                  </th>
                  <td colSpan={roles.length} />
                </tr>
                {permissions
                  .filter((permission) => permission.module === module)
                  .map((permission) => (
                    <tr key={permission.id} className="border-t border-creaw-divider">
                      <th className="sticky left-0 bg-white p-3 text-left font-medium">
                        {permission.name}
                        <span className="block font-mono text-xs text-creaw-faint">
                          {permission.code}
                        </span>
                      </th>
                      {roles.map((role) => (
                        <td key={role.id} className="p-2 text-center">
                          <button
                            type="button"
                            aria-label={`${role.name}: ${permission.name}`}
                            aria-pressed={hasGrant(role, permission)}
                            disabled={!canManagePermissions || role.is_system_role}
                            onClick={() => onToggle(role, permission)}
                            className={`size-8 rounded-lg border text-sm font-bold disabled:cursor-not-allowed ${isUnsaved(role, permission) ? "border-2 border-[#E0822F]" : "border-creaw-line-strong"} ${hasGrant(role, permission) ? "bg-[#E3F3EA] text-[#1F7A4D]" : "bg-white"}`}
                          >
                            {hasGrant(role, permission) ? "✓" : ""}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
