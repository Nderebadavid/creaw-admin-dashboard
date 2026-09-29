// Pure permission checks over a session's effective grants. Safe to import
// from client components; resolving grants from roles lives in permissions.ts.

/** One permission the user holds; `pillarId: null` means it applies to every pillar. */
export interface EffectiveGrant {
  permissionCode: string;
  pillarId: number | null;
}

/** True when a grant covers `code`, either globally or for the given pillar. */
export function hasPermission(
  grants: readonly EffectiveGrant[],
  code: string,
  options: { pillarId?: number | null } = {}
): boolean {
  return grants.some(
    (grant) =>
      grant.permissionCode === code &&
      (grant.pillarId === null || (options.pillarId != null && grant.pillarId === options.pillarId))
  );
}

/** True when the user holds `code` for at least one pillar (enough to open the module). */
export function hasModulePermission(grants: readonly EffectiveGrant[], code: string): boolean {
  return grants.some((grant) => grant.permissionCode === code);
}
