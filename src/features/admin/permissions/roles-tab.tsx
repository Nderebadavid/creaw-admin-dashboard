"use client";
import { useState } from "react";
import { Check, ChevronRight, KeyRound, LockKeyhole, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PermissionView, RoleView } from "../api";

const matches = (permission: PermissionView, query: string) =>
  `${permission.name} ${permission.code} ${permission.description ?? ""}`
    .toLowerCase()
    .includes(query.toLowerCase());

/** Modules gathered into a few areas so a role reads as sections, not one long list. */
const AREAS: { label: string; modules: string[] }[] = [
  {
    label: "Programmes",
    modules: ["VAWG", "WEE", "SRHR", "SRHR_SKILLING", "SKILLING", "WROS", "LEADERSHIP"],
  },
  { label: "People & records", modules: ["PARTICIPANT", "REFERRAL", "ORGANISATION", "DOCUMENT"] },
  { label: "Money & reporting", modules: ["GRANTS", "REPORTING"] },
  { label: "Platform", modules: ["ADMIN", "GLOBAL"] },
];

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
  const [roleQuery, setRoleQuery] = useState("");
  const [filter, setFilter] = useState<"All" | "Granted" | "Not granted">("All");
  const granted = (permission: PermissionView) =>
    Boolean(selected && hasGrant(selected, permission));
  const modules = [...new Set(permissions.map((permission) => permission.module))].sort();
  const groups = modules
    .map((module) => {
      const all = permissions.filter((permission) => permission.module === module);
      return {
        module,
        all,
        items: all.filter(
          (permission) =>
            matches(permission, query) &&
            (filter === "All" || (filter === "Granted") === granted(permission))
        ),
      };
    })
    .filter((group) => group.items.length > 0);
  // Unknown modules land in "Other", so a new module is never hidden.
  const known = new Set(AREAS.flatMap((area) => area.modules));
  const areas = [
    ...AREAS,
    { label: "Other", modules: groups.map((g) => g.module).filter((m) => !known.has(m)) },
  ]
    .map((area) => ({
      label: area.label,
      groups: groups.filter((group) => area.modules.includes(group.module)),
    }))
    .filter((area) => area.groups.length > 0);
  // Modules start collapsed; a search, a Granted/Not granted filter or an unsaved change opens
  // them. A header click overrides that until the search or filter changes.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const autoOpen = (group: (typeof groups)[number]) =>
    query.trim() !== "" ||
    filter !== "All" ||
    Boolean(selected && group.all.some((permission) => isUnsaved(selected, permission)));
  const isOpen = (group: (typeof groups)[number]) => expanded[group.module] ?? autoOpen(group);
  const toggleOpen = (group: (typeof groups)[number]) =>
    setExpanded((current) => ({ ...current, [group.module]: !isOpen(group) }));
  const setAll = (open: boolean) =>
    setExpanded(Object.fromEntries(groups.map((group) => [group.module, open])));
  const allOpen = groups.length > 0 && groups.every(isOpen);
  const countFor = (role: RoleView) =>
    permissions.filter((permission) => hasGrant(role, permission)).length;
  const editable = Boolean(selected && canManagePermissions && !selected.is_system_role);
  const visibleRoles = roles.filter((role) =>
    `${role.name} ${role.description ?? ""}`.toLowerCase().includes(roleQuery.toLowerCase())
  );

  return (
    <div className="flex flex-wrap items-start gap-5">
      <aside className="flex min-w-[260px] flex-[0_1_310px] flex-col overflow-hidden rounded-2xl border border-creaw-line bg-white">
        <div className="border-b border-creaw-divider p-3.5">
          <label className="flex h-10 items-center gap-2 rounded-[10px] border border-creaw-line bg-creaw-canvas px-3">
            <Search size={18} aria-hidden className="shrink-0 text-creaw-faint" />
            <span className="sr-only">Search roles</span>
            <input
              type="search"
              value={roleQuery}
              onChange={(event) => setRoleQuery(event.target.value)}
              placeholder="Search roles"
              className="w-full min-w-0 bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        <div className="flex max-h-[calc(100vh-300px)] min-h-60 flex-col gap-0.5 overflow-y-auto p-2">
          {visibleRoles.map((role) => {
            const on = selected?.id === role.id;
            const unsaved = permissions.some((permission) => isUnsaved(role, permission));
            const count = countFor(role);
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => onSelect(role.id)}
                aria-current={on ? "true" : undefined}
                className={`flex flex-col gap-[3px] rounded-[10px] border px-3 py-2.5 text-left hover:border-[#F0CDBB] ${on ? "border-[#F0CDBB] bg-creaw-orange-soft" : "border-transparent bg-white"}`}
              >
                <span className="flex w-full items-center gap-2">
                  <span
                    className={`min-w-0 flex-1 text-[14.5px] font-semibold ${on ? "text-primary" : "text-creaw-ink"}`}
                  >
                    {role.name}
                  </span>
                  {role.is_system_role && (
                    <span className="flex items-center gap-[3px] whitespace-nowrap rounded-full bg-creaw-divider px-2 py-0.5 text-xs font-semibold text-creaw-body">
                      <LockKeyhole size={12} aria-hidden="true" />
                      System
                    </span>
                  )}
                  {unsaved && (
                    <span
                      title="Unsaved changes"
                      className="size-2 shrink-0 rounded-full bg-[#E0822F]"
                    />
                  )}
                </span>
                <span className="text-[12.5px] text-creaw-faint">
                  {count} permission{count === 1 ? "" : "s"}
                </span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-creaw-divider px-3.5 py-3">
          <button
            type="button"
            disabled={!canManageRoles}
            onClick={onNewRole}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-[#DCD4CB] text-sm font-semibold text-creaw-body hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <Plus size={18} aria-hidden="true" />
            New role
          </button>
        </div>
      </aside>
      <section className="min-w-0 flex-[1_1_560px] rounded-2xl border border-creaw-line bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3.5 border-b border-creaw-divider px-[22px] py-5">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h2 className="font-heading text-[22px] font-bold">
              {selected?.name ?? "Select a role"}
            </h2>
            <p className="text-sm leading-snug text-creaw-body">
              {selected?.description ?? "Permissions assigned to this role"}
            </p>
            {selected && (
              <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-creaw-canvas px-2.5 py-[3px] font-mono text-creaw-ink-soft">
                  {selected.code}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-creaw-orange-soft px-2.5 py-[3px] text-primary">
                  <KeyRound size={14} aria-hidden="true" />
                  {countFor(selected)} of {permissions.length} permissions
                </span>
              </div>
            )}
          </div>
          {selected && (
            <Button
              variant="outline"
              size="sm"
              disabled={!canManageRoles || selected.is_system_role}
              onClick={onEditRole}
            >
              <Pencil />
              Edit role
            </Button>
          )}
        </div>
        {selected?.is_system_role && (
          <p className="mx-[22px] mt-4 flex items-center gap-2.5 rounded-[10px] bg-creaw-canvas px-3.5 py-3 text-[13.5px] leading-normal text-creaw-body">
            <LockKeyhole size={18} className="shrink-0 text-creaw-faint" />
            Built-in roles cannot be edited. System Administrator always has every permission.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2.5 px-[22px] py-3.5">
          <label className="flex h-10 min-w-[200px] max-w-[360px] flex-1 items-center gap-2 rounded-[10px] border border-creaw-line bg-creaw-canvas px-3">
            <Search size={18} aria-hidden className="shrink-0 text-creaw-faint" />
            <span className="sr-only">Search permissions</span>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setExpanded({});
              }}
              placeholder="Search permissions"
              className="w-full min-w-0 bg-transparent text-sm outline-none"
            />
          </label>
          <div className="flex gap-1.5" role="group" aria-label="Permission filter">
            {(["All", "Granted", "Not granted"] as const).map((label) => (
              <button
                key={label}
                type="button"
                aria-pressed={filter === label}
                onClick={() => {
                  setFilter(label);
                  setExpanded({});
                }}
                className={`rounded-[9px] border px-3 py-[7px] text-[13px] font-semibold ${filter === label ? "border-[#F0CDBB] bg-creaw-orange-soft text-primary" : "border-creaw-line-strong bg-white text-creaw-body"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {selected && groups.length > 0 && (
            <button
              type="button"
              onClick={() => setAll(!allOpen)}
              className="ml-auto text-[13px] font-semibold text-primary"
            >
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
          )}
        </div>
        <div data-testid="permission-groups" className="flex flex-col gap-5 px-[22px] pb-5">
          {selected &&
            areas.map((area) => (
              <section key={area.label} aria-label={area.label} className="flex flex-col gap-2.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#A39A92]">
                  {area.label}
                </h3>
                {/* Collapsed module cards in a grid: one line each until opened. */}
                <div className="grid items-start gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  {area.groups.map((group) => {
                    const held = group.all.filter(granted);
                    const full = held.length === group.all.length;
                    const opened = isOpen(group);
                    const percent = Math.round((held.length / group.all.length) * 100);
                    const name = group.module.replaceAll("_", " ");
                    return (
                      <section
                        key={group.module}
                        aria-label={name}
                        className="overflow-hidden rounded-xl border border-creaw-divider"
                      >
                        <div className="flex items-center gap-2 bg-creaw-surface pr-3.5">
                          <button
                            type="button"
                            aria-expanded={opened}
                            onClick={() => toggleOpen(group)}
                            className="flex min-w-0 flex-1 items-center gap-2.5 px-3.5 py-2.5 text-left"
                          >
                            <ChevronRight
                              size={16}
                              aria-hidden="true"
                              className={`shrink-0 text-creaw-faint transition-transform ${opened ? "rotate-90" : ""}`}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-heading text-base font-bold tracking-[.03em]">
                                {name}
                              </span>
                              <span
                                aria-hidden="true"
                                className="mt-1 block h-1 overflow-hidden rounded-full bg-[#EDE6DE]"
                              >
                                <span
                                  className="block h-full rounded-full bg-primary"
                                  style={{ width: `${percent}%` }}
                                />
                              </span>
                            </span>
                            <span className="shrink-0 text-[12.5px] tabular-nums text-creaw-faint">
                              {held.length} of {group.all.length}
                            </span>
                          </button>
                          {editable && (
                            <button
                              type="button"
                              onClick={() =>
                                group.all
                                  .filter((permission) => granted(permission) === full)
                                  .forEach((permission) => onToggle(selected, permission))
                              }
                              className="shrink-0 text-[13px] font-semibold text-primary"
                            >
                              {full ? "Revoke all" : "Grant all"}
                            </button>
                          )}
                        </div>
                        {opened &&
                          group.items.map((permission) => {
                            const on = granted(permission);
                            const changed = isUnsaved(selected, permission);
                            return (
                              <button
                                key={permission.id}
                                type="button"
                                disabled={!editable}
                                aria-pressed={on}
                                title={permission.description ?? undefined}
                                onClick={() => onToggle(selected, permission)}
                                className={`flex w-full items-center gap-2.5 border-t border-creaw-divider px-3.5 py-2 text-left hover:bg-creaw-surface disabled:cursor-not-allowed ${changed ? "bg-[#FFF8F2]" : "bg-white"}`}
                              >
                                <span
                                  className={`flex size-[20px] shrink-0 items-center justify-center rounded-md border-[1.5px] text-white ${on ? (selected.is_system_role ? "border-[#C9C0B7] bg-[#C9C0B7]" : "border-primary bg-primary") : "border-[#CFC6BC] bg-white"}`}
                                >
                                  {on && <Check size={14} aria-hidden="true" />}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-creaw-ink">
                                  {permission.name}
                                </span>
                                {permission.description && (
                                  <span className="sr-only">{permission.description}</span>
                                )}
                                {changed && (
                                  <span className="whitespace-nowrap rounded-full bg-creaw-orange-soft px-2 py-0.5 text-xs font-semibold text-primary">
                                    {on ? "Will be granted" : "Will be revoked"}
                                  </span>
                                )}
                                <span className="shrink-0 font-mono text-[11.5px] text-creaw-faint">
                                  {permission.code}
                                </span>
                              </button>
                            );
                          })}
                      </section>
                    );
                  })}
                </div>
              </section>
            ))}
          {groups.length === 0 && (
            <p className="py-8 text-center text-[14.5px] text-creaw-faint">
              No permissions match this filter.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
