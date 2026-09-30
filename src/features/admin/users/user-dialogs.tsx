"use client";
import { fieldClass } from "@/components/ui/form-styles";
import type { FormEvent } from "react";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { createUserAction, setUserRoleAction, updateUserAction } from "../actions";
import type { RoleView, UserRoleView, UserView } from "../api";

type Done = (message: string) => void;

/** Adds a staff account, or edits one when `user` is given. Blank contacts keep their value. */
export function StaffDialog({
  open,
  user,
  onClose,
  onDone,
}: {
  open: boolean;
  user: UserView | null;
  onClose: () => void;
  onDone: Done;
}) {
  const submit = useActionSubmit(onDone);
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const firstName = String(form.get("firstName") ?? "");
    const lastName = String(form.get("lastName") ?? "");
    const email = String(form.get("email") ?? "");
    const phoneNumber = String(form.get("phoneNumber") ?? "");
    void submit.run(
      user
        ? updateUserAction({
            id: user.id,
            firstName,
            lastName,
            ...(email ? { email } : {}),
            ...(phoneNumber ? { phoneNumber } : {}),
          })
        : createUserAction({
            firstName,
            lastName,
            username: String(form.get("username") ?? ""),
            email: email || undefined,
            phoneNumber: phoneNumber || undefined,
          }),
      user ? "Staff details saved." : "Staff member added."
    );
  }
  return (
    <ActionDialog
      open={open}
      busy={submit.busy}
      onClose={() => {
        submit.clearError();
        onClose();
      }}
      title={user ? "Edit staff member" : "Add user"}
      description="Contact details are masked in staff views. Changes to these fields are audited."
      error={submit.error}
      className="max-h-[85dvh] overflow-y-auto"
    >
      <form onSubmit={send} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            First name
            <input
              name="firstName"
              defaultValue={user?.first_name ?? ""}
              required
              maxLength={80}
              className={fieldClass}
            />
          </label>
          <label className="text-sm">
            Last name
            <input
              name="lastName"
              defaultValue={user?.last_name ?? ""}
              required
              maxLength={80}
              className={fieldClass}
            />
          </label>
        </div>
        {!user && (
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
            placeholder={user ? (user.email ?? "Leave blank to keep current") : ""}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          Phone
          <input
            name="phoneNumber"
            placeholder={user ? (user.phone_number ?? "Leave blank to keep current") : ""}
            maxLength={12}
            className={fieldClass}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submit.busy}>
            {submit.busy ? "Saving…" : user ? "Save changes" : "Add user"}
          </Button>
        </div>
      </form>
    </ActionDialog>
  );
}

/** Lists a user's role grants and grants or revokes one, globally or per pillar. */
export function RoleGrantsDialog({
  user,
  grants,
  roles,
  pillars,
  roleName,
  scopeOf,
  isSelf,
  onClose,
  onDone,
}: {
  user: UserView | null;
  grants: UserRoleView[];
  roles: RoleView[];
  pillars: { id: number; name: string }[];
  roleName: (roleId: number) => string;
  scopeOf: (grant: UserRoleView) => string;
  /** Users may not revoke their own grants (the server enforces this too). */
  isSelf: boolean;
  onClose: () => void;
  onDone: Done;
}) {
  const submit = useActionSubmit(onDone);
  function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    void submit.run(
      setUserRoleAction({
        userId: user.id,
        roleId: Number(form.get("roleId")),
        pillarId: Number(form.get("pillarId")) || null,
        enabled: true,
      }),
      "Role grant saved."
    );
  }
  return (
    <ActionDialog
      open={user !== null}
      busy={submit.busy}
      onClose={() => {
        submit.clearError();
        onClose();
      }}
      title={user && `Role grants · ${user.first_name} ${user.last_name}`}
      description="Assign a role globally or within one pillar. Grant changes take effect immediately."
      error={submit.error}
      className="max-h-[85dvh] overflow-y-auto"
    >
      <div className="space-y-2">
        {grants.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-3 rounded-lg border p-2 text-sm"
          >
            <span>
              <strong>{roleName(row.role_id)}</strong>
              <span className="block text-xs text-creaw-faint">{scopeOf(row)}</span>
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={submit.busy || isSelf}
              onClick={() =>
                user &&
                void submit.run(
                  setUserRoleAction({
                    userId: user.id,
                    roleId: row.role_id,
                    pillarId: row.pillar_id,
                    enabled: false,
                  }),
                  "Role revoked."
                )
              }
            >
              Revoke
            </Button>
          </div>
        ))}
      </div>
      <form onSubmit={grant} className="space-y-3 border-t pt-3">
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
        <Button type="submit" disabled={submit.busy || roles.length === 0}>
          Grant role
        </Button>
      </form>
    </ActionDialog>
  );
}

/** Disables or reactivates an account; history stays in the audit log either way. */
export function AccountStatusDialog({
  user,
  onClose,
  onDone,
}: {
  user: UserView | null;
  onClose: () => void;
  onDone: Done;
}) {
  const submit = useActionSubmit(onDone);
  const active = user?.status === "ACTIVE";
  return (
    <ActionDialog
      open={user !== null}
      busy={submit.busy}
      onClose={() => {
        submit.clearError();
        onClose();
      }}
      title={active ? "Disable account?" : "Reactivate account?"}
      description={
        user &&
        `${user.first_name} ${user.last_name} ${active ? "will lose access immediately. The account remains in the audit history." : "will regain access under existing role grants."}`
      }
      error={submit.error}
    >
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant={active ? "destructive" : "default"}
          disabled={submit.busy}
          onClick={() =>
            user &&
            void submit.run(
              updateUserAction({
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                status: active ? "DISABLED" : "ACTIVE",
              }),
              active ? "Account disabled." : "Account reactivated."
            )
          }
        >
          {active ? "Disable account" : "Reactivate account"}
        </Button>
      </div>
    </ActionDialog>
  );
}
