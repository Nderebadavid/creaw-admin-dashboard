"use client";
import { FormBanner } from "@/components/ui/form-banner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  KeyRound,
  Pencil,
  Shield,
  ShieldPlus,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { RowActions } from "@/components/data-table/row-actions";
import { TableCard } from "@/components/data-table/table-card";
import { usePagedList } from "@/components/data-table/use-paged-list";
import { PageHeading, type PageHeadingText } from "@/components/portal/page-heading";
import { listUsersAction } from "./actions";
import type { SortState } from "@/components/data-table/sorting";
import type { AdminPage, RoleView, UserRoleView, UserView } from "./api";
import { staffColumns, statusLabel } from "./users/columns";
import { staffLookups } from "./users/sort-values";
import { AccountStatusDialog, RoleGrantsDialog, StaffDialog } from "./users/user-dialogs";

type Pillar = { id: number; name: string };
type UserQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  sort?: SortState;
};
type Modal = { kind: "add" } | { kind: "edit" | "roles" | "status"; user: UserView } | null;

const statuses = ["ACTIVE", "INACTIVE", "DISABLED"];

/**
 * Staff accounts and their role grants. A user's navigation and data scope
 * are the union of every active role they hold, each global or per pillar.
 */
export function UsersContent({
  heading,
  initial,
  roles,
  assignments,
  pillars,
  permissionCount,
  canManageUsers,
  canManageRoles,
  currentUserId = 0,
}: {
  heading?: PageHeadingText;
  initial: AdminPage<UserView>;
  roles: RoleView[];
  /** Every user_role row, used for role chips, scope and multi-role counts. */
  assignments: UserRoleView[];
  pillars: Pillar[];
  /** Size of the permission catalogue, when the user may see it. */
  permissionCount?: number;
  canManageUsers: boolean;
  canManageRoles: boolean;
  currentUserId?: number;
}) {
  const router = useRouter();
  const list = usePagedList<UserView, UserQuery>(
    initial,
    { page: 1, pageSize: 25 },
    listUsersAction
  );
  const [modal, setModal] = useState<Modal>(null);
  const [feedback, setFeedback] = useState("");

  const lookups = staffLookups(assignments, roles, pillars);
  const { grantsOf, roleName, scopeOf } = lookups;
  const multiRole = new Set(
    assignments
      .filter((row) => !row.is_deleted && row.status === "ACTIVE")
      .map((row) => row.user_id)
      .filter((id, index, ids) => ids.indexOf(id) !== index)
  ).size;

  const close = () => setModal(null);
  const done = (message: string) => {
    setModal(null);
    setFeedback(message);
    void list.refresh();
    router.refresh();
  };
  const userFor = (kind: "roles" | "status") => (modal?.kind === kind ? modal.user : null);

  const addButton = (
    <Button
      disabled={!canManageUsers}
      title={!canManageUsers ? "User management permission required" : undefined}
      onClick={() => setModal({ kind: "add" })}
    >
      <UserPlus />
      Add user
    </Button>
  );
  const stats = [
    { icon: Users, value: list.data.totalItems, label: "Staff accounts" },
    { icon: Shield, value: roles.length, label: "Roles configured" },
    { icon: BadgeCheck, value: multiRole, label: "Multi-role users" },
    { icon: KeyRound, value: permissionCount ?? "—", label: "Permissions" },
  ];

  return (
    <div className="space-y-5">
      {heading ? <PageHeading {...heading} actions={addButton} /> : addButton}
      <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ icon: Icon, value, label }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-2xl border border-creaw-line bg-white p-5"
          >
            <span className="flex size-[46px] shrink-0 items-center justify-center rounded-xl bg-[#F7E6DC] text-creaw-orange">
              <Icon size={23} aria-hidden="true" />
            </span>
            <div className="flex flex-col">
              <strong className="font-heading text-[28px] leading-[1.05]">{value}</strong>
              <p className="text-[13.5px] text-creaw-faint">{label}</p>
            </div>
          </div>
        ))}
      </div>
      <FormBanner tone="success">{feedback}</FormBanner>
      {!modal && <FormBanner tone="error">{list.error}</FormBanner>}
      <TableCard
        title="Staff accounts"
        subtitle="Multiple roles combine their permitted modules and pillar scopes."
        chipsLabel="Staff status"
        chips={[
          {
            label: "All",
            active: !list.query.status,
            onSelect: () => list.filter({ status: undefined }),
          },
          ...statuses.map((status) => ({
            label: statusLabel(status),
            active: list.query.status === status,
            onSelect: () => list.filter({ status }),
          })),
        ]}
        search={{
          value: list.query.search ?? "",
          label: "Search staff",
          onChange: (value) => list.filter({ search: value || undefined }),
        }}
        footer={
          <Pagination
            page={list.data.page}
            pageSize={list.data.pageSize as PageSize}
            totalItems={list.data.totalItems}
            hint="Multi-role users see the union of their roles’ modules"
            onPageChange={(page) => list.filter({ page }, false)}
            onPageSizeChange={(pageSize) => list.filter({ pageSize })}
          />
        }
      >
        <DataTable
          framed={false}
          label="Staff"
          columns={staffColumns(lookups)}
          sort={list.query.sort}
          onSortChange={(sort) => list.filter({ sort })}
          rows={list.data.items}
          getRowId={(user) => user.id}
          loading={list.loading}
          filtered={Boolean(list.query.search || list.query.status)}
          rowActions={(user) => (
            <RowActions
              label={`${user.first_name} ${user.last_name}`}
              actions={[
                {
                  label: "Edit user",
                  icon: Pencil,
                  disabled: !canManageUsers,
                  onSelect: () => setModal({ kind: "edit", user }),
                },
                {
                  label: "Grant role",
                  icon: ShieldPlus,
                  disabled: !canManageRoles,
                  onSelect: () => setModal({ kind: "roles", user }),
                },
                {
                  label: user.status === "ACTIVE" ? "Deactivate" : "Reactivate",
                  icon: user.status === "ACTIVE" ? UserX : UserCheck,
                  destructive: user.status === "ACTIVE",
                  // Users cannot lock themselves out.
                  disabled: !canManageUsers || user.id === currentUserId,
                  onSelect: () => setModal({ kind: "status", user }),
                },
              ]}
            />
          )}
        />
      </TableCard>
      <StaffDialog
        open={modal?.kind === "add" || modal?.kind === "edit"}
        user={modal?.kind === "edit" ? modal.user : null}
        onClose={close}
        onDone={done}
      />
      <RoleGrantsDialog
        user={userFor("roles")}
        grants={userFor("roles") ? grantsOf(userFor("roles")!.id) : []}
        roles={roles}
        pillars={pillars}
        roleName={roleName}
        scopeOf={scopeOf}
        isSelf={userFor("roles")?.id === currentUserId}
        onClose={close}
        onDone={done}
      />
      <AccountStatusDialog user={userFor("status")} onClose={close} onDone={done} />
    </div>
  );
}
