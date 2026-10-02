"use client";
import { FormBanner } from "@/components/ui/form-banner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Grid2X2, KeyRound, ShieldCheck } from "lucide-react";
import { PageHeading, type PageHeadingText } from "@/components/portal/page-heading";
import { Button } from "@/components/ui/button";
import { setRolePermissionAction } from "./actions";
import type { PermissionView, RolePermissionView, RoleView } from "./api";
import { CatalogueTab } from "./permissions/catalogue-tab";
import { MatrixTab } from "./permissions/matrix-tab";
import { PermissionDialog } from "./permissions/permission-dialog";
import { ReviewDialog } from "./permissions/review-dialog";
import { RoleDialog } from "./permissions/role-dialog";
import { RolesTab } from "./permissions/roles-tab";
import { cellKey, usePermissionMatrix } from "./permissions/use-permission-matrix";

type Tab = "roles" | "permissions" | "matrix";
type Modal = "new-role" | "edit-role" | "new-permission" | "review" | null;

/**
 * Roles & permissions screen. Grant edits are staged locally in all three tabs
 * and saved together from the review dialog; role and permission creation save
 * immediately.
 */
export function PermissionsContent({
  heading,
  roles,
  permissions,
  grants,
  canManageRoles,
  canManagePermissions,
}: {
  heading?: PageHeadingText;
  roles: RoleView[];
  permissions: PermissionView[];
  /** Current role-permission rows from the server; a new array means a refresh. */
  grants: RolePermissionView[];
  canManageRoles: boolean;
  canManagePermissions: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("roles");
  const [selectedId, setSelectedId] = useState(roles[0]?.id ?? 0);
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const matrix = usePermissionMatrix(roles, permissions, grants);
  const selected = roles.find((role) => role.id === selectedId) ?? roles[0];

  const open = (next: Modal) => {
    setError("");
    setModal(next);
  };
  const toggle = (role: RoleView, permission: PermissionView) => {
    if (canManagePermissions && !role.is_system_role) matrix.toggle(role, permission);
  };
  const saved = (message: string) => {
    setFeedback(message);
    setModal(null);
    router.refresh();
  };

  // Applies staged changes one at a time. On the first failure, whatever was
  // applied so far becomes the saved state and the rest stay staged for review.
  async function saveChanges() {
    setBusy(true);
    setError("");
    const next = new Set(matrix.saved);
    let applied = 0;
    for (const item of matrix.changes) {
      const response = await setRolePermissionAction({
        roleId: item.role.id,
        permissionId: item.permission.id,
        enabled: item.enabled,
      });
      if (!response.success) {
        matrix.markSaved(next, false);
        setError(
          `${response.message}. ${applied === 0 ? "No changes saved." : "Some changes were saved; review remaining changes."}`
        );
        setBusy(false);
        router.refresh();
        return;
      }
      applied++;
      const entry = cellKey(item.role.id, item.permission.id);
      if (item.enabled) next.add(entry);
      else next.delete(entry);
    }
    matrix.markSaved(next, true);
    setBusy(false);
    saved("Permission changes saved and effective grants updated.");
  }

  const tabs = [
    { value: "roles", label: "Roles", Icon: ShieldCheck, count: roles.length },
    { value: "permissions", label: "Permissions", Icon: KeyRound, count: permissions.length },
    {
      value: "matrix",
      label: "Matrix overview",
      Icon: Grid2X2,
      count: `${roles.length}×${permissions.length}`,
    },
  ] as const;

  return (
    <div className="space-y-5">
      {heading && <PageHeading {...heading} />}
      <div
        role="tablist"
        aria-label="Roles and permissions"
        className="flex gap-1 overflow-x-auto border-b border-creaw-line-strong"
      >
        {tabs.map(({ value, label, Icon, count }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold ${tab === value ? "border-creaw-orange text-creaw-orange" : "border-transparent text-creaw-body"}`}
          >
            <Icon size={18} />
            {label}
            <span className="rounded-full bg-creaw-divider px-2 py-0.5 text-xs">{count}</span>
          </button>
        ))}
      </div>
      <FormBanner tone="success">{feedback}</FormBanner>
      {!modal && <FormBanner tone="error">{error}</FormBanner>}
      {tab === "roles" && (
        <RolesTab
          roles={roles}
          permissions={permissions}
          selected={selected}
          onSelect={setSelectedId}
          hasGrant={matrix.hasGrant}
          isUnsaved={matrix.isUnsaved}
          onToggle={toggle}
          canManageRoles={canManageRoles}
          canManagePermissions={canManagePermissions}
          onNewRole={() => open("new-role")}
          onEditRole={() => open("edit-role")}
        />
      )}
      {tab === "permissions" && (
        <CatalogueTab
          roles={roles}
          permissions={permissions}
          hasGrant={matrix.hasGrant}
          canManagePermissions={canManagePermissions}
          onNewPermission={() => open("new-permission")}
        />
      )}
      {tab === "matrix" && (
        <MatrixTab
          roles={roles}
          permissions={permissions}
          hasGrant={matrix.hasGrant}
          isUnsaved={matrix.isUnsaved}
          onToggle={toggle}
          canManagePermissions={canManagePermissions}
        />
      )}
      {matrix.changes.length > 0 && (
        <div className="sticky bottom-4 z-20 ml-auto flex w-fit max-w-full flex-wrap items-center gap-3 rounded-xl bg-creaw-ink p-3 text-sm text-white shadow-xl">
          <span>
            {matrix.changes.length} unsaved change{matrix.changes.length === 1 ? "" : "s"}
          </span>
          <Button variant="outline" onClick={matrix.discard}>
            Discard
          </Button>
          <Button disabled={busy} onClick={() => open("review")}>
            Review &amp; save
          </Button>
        </div>
      )}
      <RoleDialog
        open={modal === "new-role" || modal === "edit-role"}
        role={modal === "edit-role" ? selected : undefined}
        onClose={() => setModal(null)}
        onSaved={saved}
      />
      <PermissionDialog
        open={modal === "new-permission"}
        onClose={() => setModal(null)}
        onSaved={saved}
      />
      <ReviewDialog
        open={modal === "review"}
        changes={matrix.changes}
        busy={busy}
        error={error}
        onClose={() => setModal(null)}
        onConfirm={() => void saveChanges()}
      />
    </div>
  );
}
