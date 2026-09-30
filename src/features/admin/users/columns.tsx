import type { DataColumn } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import type { UserRoleView, UserView } from "../api";

export const statusLabel = (status: string) =>
  status === "ACTIVE" ? "Active" : status === "DISABLED" ? "Disabled" : "Inactive";

/**
 * Staff columns from the design. Contacts arrive masked; revealing them is an
 * audited action elsewhere. Roles and scope come from active user_role rows.
 */
export function staffColumns({
  grantsOf,
  roleName,
  scopeOf,
}: {
  grantsOf: (userId: number) => UserRoleView[];
  roleName: (roleId: number) => string;
  scopeOf: (grant: UserRoleView) => string;
}): DataColumn<UserView>[] {
  return [
    {
      id: "staff",
      header: "Staff member",
      cell: (user) => (
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FDEFD9] text-xs font-bold text-[#8C4A0E]">
            {user.first_name[0]}
            {user.last_name[0]}
          </span>
          <div>
            <strong className="whitespace-nowrap">
              {user.first_name} {user.last_name}
            </strong>
            <div className="font-mono text-xs text-creaw-faint">{user.username}</div>
          </div>
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      cell: (user) => (
        <div className="space-y-0.5 text-xs text-creaw-body">
          <div>{user.email ?? "—"}</div>
          <div className="font-mono">{user.phone_number ?? "—"}</div>
        </div>
      ),
    },
    {
      id: "roles",
      header: "Roles",
      cell: (user) => (
        <div className="flex flex-wrap gap-1">
          {grantsOf(user.id).map((grant) => (
            <span
              key={grant.id}
              className="rounded-[7px] bg-creaw-canvas px-2 py-0.5 text-xs font-semibold"
            >
              {roleName(grant.role_id)}
            </span>
          ))}
        </div>
      ),
    },
    {
      id: "scope",
      header: "Pillar scope",
      cell: (user) => (
        <span className="text-sm text-creaw-ink-soft">
          {[...new Set(grantsOf(user.id).map(scopeOf))].join(", ") || "No role"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (user) => (
        <StatusBadge tone={user.status === "ACTIVE" ? "success" : "warning"}>
          {statusLabel(user.status)}
        </StatusBadge>
      ),
    },
  ];
}
