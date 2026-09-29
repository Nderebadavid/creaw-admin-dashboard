"use client";
import { useState } from "react";
import { LockKeyhole, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PermissionView, RoleView } from "../api";

const matches = (permission: PermissionView, query: string) =>
  `${permission.name} ${permission.code} ${permission.description ?? ""}`
    .toLowerCase()
    .includes(query.toLowerCase());

/** Role list on the left; the selected role's permissions, grouped by module, on the right. */
export function RolesTab({
  roles,
  permissions,
  selected,
  onSelect,
  hasGrant,
  isUnsaved,
  onToggle,
  canManageRoles,
  canManagePermissions,
  onNewRole,
  onEditRole,
}: {
  roles: RoleView[];
  permissions: PermissionView[];
  selected: RoleView | undefined;
  onSelect: (roleId: number) => void;
  hasGrant: (role: RoleView, permission: PermissionView) => boolean;
  isUnsaved: (role: RoleView, permission: PermissionView) => boolean;
  onToggle: (role: RoleView, permission: PermissionView) => void;
  canManageRoles: boolean;
  canManagePermissions: boolean;
  onNewRole: () => void;
  onEditRole: () => void;
}) {
  const [query, setQuery] = useState("");
  const modules = [...new Set(permissions.map((permission) => permission.module))].sort();
  const groups = modules
    .map((module) => ({
      module,
      items: permissions.filter(
        (permission) => permission.module === module && matches(permission, query)
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-creaw-line bg-white p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold">Roles</h2>
          <Button size="sm" disabled={!canManageRoles} onClick={onNewRole}>
            <Plus size={14} />
            New
          </Button>
        </div>
        <div className="space-y-1">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => onSelect(role.id)}
              aria-current={selected?.id === role.id ? "true" : undefined}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selected?.id === role.id ? "bg-creaw-orange-soft font-semibold text-creaw-orange" : "hover:bg-creaw-surface"}`}
            >
              {role.name}
              {role.is_system_role && <LockKeyhole size={12} className="ml-2 inline" />}
            </button>
          ))}
        </div>
      </aside>
      <section className="min-w-0 rounded-2xl border border-creaw-line bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-creaw-divider p-5">
          <div>
            <h2 className="font-heading text-2xl font-bold">{selected?.name ?? "Select a role"}</h2>
            <p className="text-sm text-creaw-faint">
              {selected?.description ?? "Permissions assigned to this role"}
            </p>
            <div className="mt-2 flex gap-2 text-xs text-creaw-body">
              <span className="rounded-full bg-creaw-canvas px-2 py-1">{selected?.code}</span>
              <span className="rounded-full bg-creaw-canvas px-2 py-1">
                {selected ? permissions.filter((item) => hasGrant(selected, item)).length : 0}{" "}
                permissions
              </span>
            </div>
          </div>
          {selected && (
            <Button
              variant="outline"
              disabled={!canManageRoles || selected.is_system_role}
              onClick={onEditRole}
            >
              Edit role
            </Button>
          )}
        </div>
        {selected?.is_system_role && (
          <p className="mx-5 mt-4 flex items-center gap-2 rounded-lg bg-creaw-canvas p-3 text-sm text-creaw-body">
            <LockKeyhole size={17} />
            Built-in roles cannot be edited. System Administrator always has every permission.
          </p>
        )}
        <div className="p-5">
          <label className="mb-4 flex max-w-sm items-center gap-2 rounded-lg border bg-creaw-canvas px-3 py-2">
            <Search size={16} aria-hidden />
            <span className="sr-only">Search permissions</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search permissions"
              className="min-w-0 w-full bg-transparent text-sm outline-none"
            />
          </label>
          <div className="space-y-4">
            {selected &&
              groups.map((group) => (
                <section
                  key={group.module}
                  className="overflow-hidden rounded-xl border border-creaw-divider"
                >
                  <h3 className="flex items-center justify-between bg-creaw-surface px-4 py-3 font-heading font-bold">
                    {group.module.replaceAll("_", " ")}
                    <span className="text-xs font-normal text-creaw-faint">
                      {group.items.length}
                    </span>
                  </h3>
                  {group.items.map((permission) => (
                    <button
                      key={permission.id}
                      type="button"
                      disabled={!canManagePermissions || selected.is_system_role}
                      aria-pressed={hasGrant(selected, permission)}
                      onClick={() => onToggle(selected, permission)}
                      className="flex w-full items-center gap-3 border-t border-creaw-divider px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded border ${hasGrant(selected, permission) ? "border-creaw-orange bg-creaw-orange text-white" : "border-[#CFC6BC]"}`}
                      >
                        {hasGrant(selected, permission) && "✓"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="text-sm">{permission.name}</strong>
                        <span className="ml-2 font-mono text-xs text-creaw-faint">
                          {permission.code}
                        </span>
                        <span className="block text-xs text-creaw-faint">
                          {permission.description}
                        </span>
                      </span>
                      {isUnsaved(selected, permission) && (
                        <span className="rounded-full bg-creaw-orange-soft px-2 py-1 text-xs text-creaw-orange">
                          Unsaved
                        </span>
                      )}
                    </button>
                  ))}
                </section>
              ))}
            {groups.length === 0 && (
              <p className="py-8 text-center text-sm text-creaw-faint">
                No permissions match this filter.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
