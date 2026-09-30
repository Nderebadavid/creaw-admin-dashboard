import type { SortValues } from "@/components/data-table/sorting";
import type { RoleView, UserRoleView, UserView } from "../api";

/** Role and scope lookups the staff table derives from every user_role row. */
export function staffLookups(
  assignments: UserRoleView[],
  roles: RoleView[],
  pillars: { id: number; name: string }[]
) {
  return {
    grantsOf: (userId: number) =>
      assignments.filter(
        (row) => row.user_id === userId && !row.is_deleted && row.status === "ACTIVE"
      ),
    roleName: (roleId: number) =>
      roles.find((role) => role.id === roleId)?.name ?? `Role #${roleId}`,
    scopeOf: (grant: UserRoleView) =>
      grant.pillar_id === null
        ? "System-wide"
        : (pillars.find((pillar) => pillar.id === grant.pillar_id)?.name ??
          `Pillar #${grant.pillar_id}`),
  };
}
export type StaffLookups = ReturnType<typeof staffLookups>;

/** The scopes a user's active roles cover, as the staff table shows them. */
export const scopesOf = (user: UserView, { grantsOf, scopeOf }: StaffLookups) =>
  [...new Set(grantsOf(user.id).map(scopeOf))].join(", ") || "No role";

/** What each staff column sorts by: the text the cell shows. Contacts arrive masked. */
export const staffSortValues = (lookups: StaffLookups): SortValues<UserView> => ({
  staff: (user) => `${user.first_name} ${user.last_name}`,
  contact: (user) => user.email ?? user.phone_number,
  roles: (user) =>
    lookups
      .grantsOf(user.id)
      .map((grant) => lookups.roleName(grant.role_id))
      .join(", "),
  scope: (user) => scopesOf(user, lookups),
  status: (user) => user.status,
});
