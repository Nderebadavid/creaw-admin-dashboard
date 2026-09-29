"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, UserRound, Shield, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/data-table/data-table";
import { Pagination, type PageSize } from "@/components/data-table/pagination";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { createUserAction, listUsersAction, setUserRoleAction, updateUserAction } from "./actions";
import type { AdminPage, RoleView, UserRoleView, UserView } from "./api";

type Pillar = { id: number; name: string };
type UserQuery = { page: number; pageSize: number; search?: string; status?: string };
const fieldClass =
  "mt-1 w-full rounded-lg border border-[#E2DBD3] bg-white p-2 text-sm focus-visible:outline-2 focus-visible:outline-primary";
export function UsersContent({
  initial,
  roles,
  assignments,
  pillars,
  canManageUsers,
  canManageRoles,
  currentUserId = 0,
}: {
  initial: AdminPage<UserView>;
  roles: RoleView[];
  assignments: UserRoleView[];
  pillars: Pillar[];
  canManageUsers: boolean;
  canManageRoles: boolean;
  currentUserId?: number;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial),
    [query, setQuery] = useState<UserQuery>({ page: 1, pageSize: 25 });
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState("");
  const [modal, setModal] = useState<"add" | "edit" | "roles" | "status" | null>(null),
    [selected, setSelected] = useState<UserView | null>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let active = true;
    const timer = setTimeout(
      async () => {
        const response = await listUsersAction(query);
        if (!active) return;
        if (response.success && response.data) {
          setData(response.data);
          setError("");
        } else setError(response.message);
        setLoading(false);
      },
      query.search ? 250 : 0
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  const filter = (patch: Partial<UserQuery>) => {
    setLoading(true);
    setQuery((current) => ({ ...current, ...patch, page: 1 }));
  };
  async function refresh() {
    const response = await listUsersAction(query);
    if (response.success && response.data) setData(response.data);
    else setError(response.message);
    router.refresh();
  }
  function open(next: typeof modal, user: UserView | null = null) {
    setSelected(user);
    setModal(next);
    setError("");
    setFeedback("");
  }
  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const firstName = String(form.get("firstName") ?? ""),
      lastName = String(form.get("lastName") ?? "");
    const email = String(form.get("email") ?? ""),
      phoneNumber = String(form.get("phoneNumber") ?? "");
    const response =
      modal === "add"
        ? await createUserAction({
            firstName,
            lastName,
            username: String(form.get("username") ?? ""),
            email: email || undefined,
            phoneNumber: phoneNumber || undefined,
          })
        : await updateUserAction({
            id: selected?.id,
            firstName,
            lastName,
            ...(email ? { email } : {}),
            ...(phoneNumber ? { phoneNumber } : {}),
          });
    setBusy(false);
    if (response.success) {
      setFeedback(modal === "add" ? "Staff member added." : "Staff details saved.");
      setModal(null);
      void refresh();
    } else setError(response.message);
  }
  async function toggleStatus() {
    if (!selected) return;
    setBusy(true);
    const response = await updateUserAction({
      id: selected.id,
      firstName: selected.first_name,
      lastName: selected.last_name,
      status: selected.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
    });
    setBusy(false);
    if (response.success) {
      setFeedback(selected.status === "ACTIVE" ? "Account disabled." : "Account reactivated.");
      setModal(null);
      void refresh();
    } else setError(response.message);
  }
  async function grantRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const response = await setUserRoleAction({
      userId: selected.id,
      roleId: Number(form.get("roleId")),
      pillarId: Number(form.get("pillarId")) || null,
      enabled: true,
    });
    setBusy(false);
    if (response.success) {
      setFeedback("Role grant saved.");
      setModal(null);
      void refresh();
    } else setError(response.message);
  }
  async function revokeRole(row: UserRoleView) {
    if (!selected) return;
    setBusy(true);
    const response = await setUserRoleAction({
      userId: selected.id,
      roleId: row.role_id,
      pillarId: row.pillar_id,
      enabled: false,
    });
    setBusy(false);
    if (response.success) {
      setFeedback("Role revoked.");
      setModal(null);
      void refresh();
    } else setError(response.message);
  }
  const grantsOf = (id: number) =>
    assignments.filter((row) => row.user_id === id && !row.is_deleted && row.status === "ACTIVE");
  const scopeOf = (row: UserRoleView) =>
    row.pillar_id === null
      ? "System-wide"
      : (pillars.find((pillar) => pillar.id === row.pillar_id)?.name ?? `Pillar #${row.pillar_id}`);
  const columns: DataColumn<UserView>[] = [
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
            <strong>
              {user.first_name} {user.last_name}
            </strong>
            <div className="font-mono text-xs text-[#8A8078]">{user.username}</div>
          </div>
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      cell: (user) => (
        <div className="space-y-1 text-xs text-[#6B625B]">
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
            <span key={grant.id} className="rounded-md border bg-[#F7F4F0] px-2 py-1 text-xs">
              {roles.find((role) => role.id === grant.role_id)?.name ?? `Role #${grant.role_id}`}
            </span>
          ))}
        </div>
      ),
    },
    {
      id: "scope",
      header: "Scope",
      cell: (user) => (
        <span className="text-sm text-[#6B625B]">
          {[...new Set(grantsOf(user.id).map(scopeOf))].join(", ") || "No role"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (user) => (
        <StatusBadge tone={user.status === "ACTIVE" ? "success" : "warning"}>
          {user.status === "ACTIVE"
            ? "Active"
            : user.status === "DISABLED"
              ? "Disabled"
              : "Inactive"}
        </StatusBadge>
      ),
    },
  ];
  const activeCount = data.items.filter((user) => user.status === "ACTIVE").length;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [UserRound, data.totalItems, "Staff accounts"],
          [UserCheck, activeCount, "Active on page"],
          [Shield, roles.length, "Available roles"],
          [UserX, data.items.length - activeCount, "Other statuses on page"],
        ].map(([Icon, value, label], index) => {
          const Component = Icon as typeof UserRound;
          return (
            <div
              key={index}
              className="flex items-center gap-3 rounded-2xl border border-[#ECE6DF] bg-white p-4"
            >
              <span className="rounded-xl bg-[#F7E6DC] p-3 text-[#B4552E]">
                <Component size={22} />
              </span>
              <div>
                <strong className="font-heading text-2xl">{value as number}</strong>
                <p className="text-xs text-[#8A8078]">{label as string}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="rounded-2xl border border-[#ECE6DF] bg-white p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-bold">Staff accounts</h2>
            <p className="text-sm text-[#8A8078]">
              Multiple roles combine their permitted modules and pillar scopes.
            </p>
          </div>
          <Button
            disabled={!canManageUsers}
            title={!canManageUsers ? "User management permission required" : undefined}
            onClick={() => open("add")}
          >
            <Plus size={16} />
            Add staff
          </Button>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border bg-[#F7F4F0] px-3 py-2">
            <Search size={16} aria-hidden />
            <span className="sr-only">Search staff</span>
            <input
              type="search"
              value={query.search ?? ""}
              onChange={(event) => filter({ search: event.target.value || undefined })}
              placeholder="Search name or username"
              className="min-w-0 w-full bg-transparent text-sm outline-none"
            />
          </label>
          <div role="group" aria-label="Staff status" className="flex flex-wrap gap-2">
            {["All", "ACTIVE", "INACTIVE", "DISABLED"].map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={(query.status ?? "All") === status}
                onClick={() => filter({ status: status === "All" ? undefined : status })}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${(query.status ?? "All") === status ? "border-[#F0CDBB] bg-[#FBEDE5] text-[#B4552E]" : "bg-white text-[#6B625B]"}`}
              >
                {status === "All" ? "All" : status[0] + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        {feedback && (
          <p role="status" className="mb-3 rounded-lg bg-[#EAF5ED] p-3 text-sm text-[#246842]">
            {feedback}
          </p>
        )}
        {error && !modal && (
          <p role="alert" className="mb-3 rounded-lg bg-[#FBE9E6] p-3 text-sm text-[#B8352C]">
            {error}
          </p>
        )}
        <DataTable
          label="Staff"
          columns={columns}
          rows={data.items}
          getRowId={(user) => user.id}
          loading={loading}
          filtered={Boolean(query.search || query.status)}
          rowActions={(user) => (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={!canManageUsers}
                onClick={() => open("edit", user)}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canManageRoles}
                onClick={() => open("roles", user)}
              >
                Roles
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canManageUsers || user.id === currentUserId}
                title={
                  user.id === currentUserId ? "You cannot disable your own account" : undefined
                }
                onClick={() => open("status", user)}
              >
                {user.status === "ACTIVE" ? "Disable" : "Activate"}
              </Button>
            </div>
          )}
        />
        <Pagination
          page={data.page}
          pageSize={data.pageSize as PageSize}
          totalItems={data.totalItems}
          onPageChange={(page) => {
            setLoading(true);
            setQuery((current) => ({ ...current, page }));
          }}
          onPageSizeChange={(pageSize) => {
            setLoading(true);
            setQuery((current) => ({ ...current, pageSize, page: 1 }));
          }}
        />
      </div>
      <Dialog
        open={modal === "add" || modal === "edit"}
        onOpenChange={(value) => {
          if (!value && !busy) setModal(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogTitle>{modal === "add" ? "Add staff member" : "Edit staff member"}</DialogTitle>
          <DialogDescription>
            Contact details are masked in staff views. Changes to these fields are audited.
          </DialogDescription>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <form onSubmit={saveUser} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                First name
                <input
                  name="firstName"
                  defaultValue={modal === "edit" ? selected?.first_name : ""}
                  required
                  maxLength={80}
                  className={fieldClass}
                />
              </label>
              <label className="text-sm">
                Last name
                <input
                  name="lastName"
                  defaultValue={modal === "edit" ? selected?.last_name : ""}
                  required
                  maxLength={80}
                  className={fieldClass}
                />
              </label>
            </div>
            {modal === "add" && (
              <label className="block text-sm">
                Username
                <input
                  name="username"
                  required
                  minLength={3}
                  maxLength={60}
                  pattern="[a-zA-Z0-9._-]+"
                  className={fieldClass}
                />
              </label>
            )}
            <label className="block text-sm">
              Email
              <input
                name="email"
                type="email"
                placeholder={
                  modal === "edit" ? (selected?.email ?? "Leave blank to keep current") : ""
                }
                className={fieldClass}
              />
            </label>
            <label className="block text-sm">
              Phone
              <input
                name="phoneNumber"
                placeholder={
                  modal === "edit" ? (selected?.phone_number ?? "Leave blank to keep current") : ""
                }
                maxLength={12}
                className={fieldClass}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : modal === "add" ? "Add staff" : "Save changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={modal === "roles"}
        onOpenChange={(value) => {
          if (!value && !busy) setModal(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogTitle>
            Role grants · {selected?.first_name} {selected?.last_name}
          </DialogTitle>
          <DialogDescription>
            Assign a role globally or within one pillar. Grant changes take effect immediately.
          </DialogDescription>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="space-y-2">
            {selected &&
              grantsOf(selected.id).map((grant) => (
                <div
                  key={grant.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-2 text-sm"
                >
                  <span>
                    <strong>
                      {roles.find((role) => role.id === grant.role_id)?.name ??
                        `Role #${grant.role_id}`}
                    </strong>
                    <span className="block text-xs text-[#8A8078]">{scopeOf(grant)}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || selected.id === currentUserId}
                    onClick={() => void revokeRole(grant)}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
          </div>
          <form onSubmit={grantRole} className="space-y-3 border-t pt-3">
            <label className="block text-sm">
              Role
              <select name="roleId" required className={fieldClass}>
                {roles
                  .filter((role) => !role.is_deleted && role.status === "ACTIVE")
                  .map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm">
              Scope
              <select name="pillarId" className={fieldClass}>
                <option value="">System-wide</option>
                {pillars.map((pillar) => (
                  <option key={pillar.id} value={pillar.id}>
                    {pillar.name}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={busy || roles.length === 0}>
              Grant role
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={modal === "status"}
        onOpenChange={(value) => {
          if (!value && !busy) setModal(null);
        }}
      >
        <DialogContent>
          <DialogTitle>
            {selected?.status === "ACTIVE" ? "Disable account?" : "Reactivate account?"}
          </DialogTitle>
          <DialogDescription>
            {selected?.first_name} {selected?.last_name}{" "}
            {selected?.status === "ACTIVE"
              ? "will lose access immediately. The account remains in the audit history."
              : "will regain access under existing role grants."}
          </DialogDescription>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button
              variant={selected?.status === "ACTIVE" ? "destructive" : "default"}
              disabled={busy}
              onClick={() => void toggleStatus()}
            >
              {selected?.status === "ACTIVE" ? "Disable account" : "Reactivate account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
