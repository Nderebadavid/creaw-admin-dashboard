import { titleCase } from "@/lib/format";
import type { DataColumn } from "@/components/data-table/data-table";
import { withSortValues } from "@/components/data-table/sorting";
import { updatedColumn } from "@/components/data-table/record-columns";
import { StatusBadge } from "@/components/ui/status-badge";
import type { UserView } from "../api";
import { scopesOf, staffSortValues, type StaffLookups } from "./sort-values";

export const statusLabel = titleCase;

/**
 * Staff columns from the design. Contacts arrive masked; revealing them is an
 * audited action elsewhere. Roles and scope come from active user_role rows.
 */
export function staffColumns(lookups: StaffLookups): DataColumn<UserView>[] {
  const { grantsOf, roleName } = lookups;
  return withSortValues(staffSortValues(lookups), [
    {
      id: "staff",
      header: "Staff member",
      cell: (user) => (
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FDEFD9] text-[13px] font-bold text-[#8C4A0E]">
            {user.first_name[0]}
            {user.last_name[0]}
          </span>
          <div>
            <strong className="whitespace-nowrap font-semibold">
              {user.first_name} {user.last_name}
            </strong>
            <div className="font-mono text-[12.5px] text-creaw-faint">{user.username}</div>
          </div>
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      cell: (user) => (
        <div className="flex flex-col gap-0.5">
          <span className="whitespace-nowrap text-[13.5px] text-creaw-ink-soft">
            {user.email ?? "—"}
          </span>
          <span className="font-mono text-[12.5px] text-creaw-faint">
            {user.phone_number ?? "—"}
          </span>
        </div>
      ),
    },
    {
      id: "roles",
      header: "Roles",
      cell: (user) => (
        <div className="flex max-w-[280px] flex-wrap gap-1.5">
          {grantsOf(user.id).map((grant) => (
            <span
              key={grant.id}
              className="whitespace-nowrap rounded-[7px] border border-creaw-line bg-creaw-canvas px-2.5 py-1 text-[12.5px] font-semibold text-creaw-ink-soft"
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
        <span className="text-sm text-creaw-ink-soft">{scopesOf(user, lookups)}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (user) => (
        <StatusBadge dot tone={user.status === "ACTIVE" ? "success" : "warning"}>
          {statusLabel(user.status)}
        </StatusBadge>
      ),
    },
    updatedColumn((user) => user.updated_at),
  ]);
}
