"use client";
import { useState } from "react";
import type { PermissionView, RolePermissionView, RoleView } from "../api";

/** Identifies one role-permission cell, e.g. `"4:17"`. */
export const cellKey = (roleId: number, permissionId: number) => `${roleId}:${permissionId}`;

/** System Administrator implicitly holds every permission; its cells are read-only. */
export const isSystemAdmin = (role: RoleView) =>
  role.is_system_role && role.code === "SYSTEM_ADMIN";

export interface PendingChange {
  role: RoleView;
  permission: PermissionView;
  enabled: boolean;
}

function activeKeys(grants: RolePermissionView[]) {
  return grants
    .filter((row) => row.status === "ACTIVE" && !row.is_deleted)
    .map((row) => cellKey(row.role_id, row.permission_id))
    .sort()
    .join("|");
}

/**
 * Tracks the saved role-permission grants and the user's unsaved edits.
 *
 * When the server sends a fresh `grants` snapshot (after `router.refresh()`),
 * the snapshot becomes the saved state, and only edits that still differ from
 * what the user had saved are carried over. This keeps a partially failed save
 * from silently discarding or re-applying changes.
 */
export function usePermissionMatrix(
  roles: RoleView[],
  permissions: PermissionView[],
  grants: RolePermissionView[]
) {
  const authoritativeKey = activeKeys(grants);
  const [matrix, setMatrix] = useState(() => {
    const initial = new Set(authoritativeKey ? authoritativeKey.split("|") : []);
    return { source: grants, saved: initial, draft: new Set(initial) };
  });

  let { saved, draft } = matrix;
  if (matrix.source !== grants) {
    // Adjusting state during render is React's recommended way to reset
    // derived state when a prop changes; it avoids an extra effect pass.
    const authoritative = new Set(authoritativeKey ? authoritativeKey.split("|") : []);
    const unresolved = [...matrix.saved, ...matrix.draft].filter(
      (entry) => matrix.saved.has(entry) !== matrix.draft.has(entry)
    );
    const nextDraft = new Set(authoritative);
    for (const entry of unresolved)
      if (matrix.draft.has(entry)) nextDraft.add(entry);
      else nextDraft.delete(entry);
    saved = authoritative;
    draft = nextDraft;
    setMatrix({ source: grants, saved, draft });
  }

  const hasGrant = (role: RoleView, permission: PermissionView) =>
    isSystemAdmin(role) || draft.has(cellKey(role.id, permission.id));
  const isUnsaved = (role: RoleView, permission: PermissionView) =>
    draft.has(cellKey(role.id, permission.id)) !== saved.has(cellKey(role.id, permission.id));

  const changes: PendingChange[] = roles.flatMap((role) =>
    role.is_system_role
      ? []
      : permissions
          .filter((permission) => isUnsaved(role, permission))
          .map((permission) => ({
            role,
            permission,
            enabled: draft.has(cellKey(role.id, permission.id)),
          }))
  );

  function toggle(role: RoleView, permission: PermissionView) {
    setMatrix((current) => {
      const next = new Set(current.draft);
      const entry = cellKey(role.id, permission.id);
      if (next.has(entry)) next.delete(entry);
      else next.add(entry);
      return { ...current, draft: next };
    });
  }

  const discard = () => setMatrix((current) => ({ ...current, draft: new Set(current.saved) }));

  /** Records what the server accepted; `clearDraft` also drops any remaining edits. */
  function markSaved(nextSaved: Set<string>, clearDraft: boolean) {
    setMatrix((current) => ({
      ...current,
      saved: nextSaved,
      draft: clearDraft ? new Set(nextSaved) : current.draft,
    }));
  }

  return { saved, hasGrant, isUnsaved, changes, toggle, discard, markSaved };
}
