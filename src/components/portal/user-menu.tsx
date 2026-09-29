"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, History, LogOut, User, UserCog } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { ActionDialog } from "@/components/ui/action-dialog";
import { usePopover } from "./use-popover";

const itemClass =
  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-creaw-ink-soft hover:bg-accent";

/** Avatar button with the user's roles, a profile summary, shortcuts and sign-out. */
export function UserMenu({
  user,
  canManageUsers,
  canViewAudit,
}: {
  user: SessionUser;
  canManageUsers: boolean;
  canViewAudit: boolean;
}) {
  const router = useRouter();
  const { ref: popoverRef, open: menuOpen, toggle: toggleMenu, close: closeMenu } = usePopover();
  const [dialog, setDialog] = useState<"profile" | "sign-out" | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const roleLine = user.roles.length ? user.roles.join(" + ") : "CREAW MERL Portal";

  const openDialog = (next: "profile" | "sign-out") => {
    closeMenu();
    setError("");
    setDialog(next);
  };

  async function signOut() {
    setSigningOut(true);
    try {
      await logoutAction();
      router.push("/login");
      router.refresh();
    } catch {
      setError("Could not sign out. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        aria-label={`Account for ${user.name}`}
        aria-expanded={menuOpen}
        onClick={toggleMenu}
        disabled={signingOut}
        className="flex items-center gap-3 border-l border-creaw-line pl-3 text-left"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
          {user.initials}
        </span>
        <span className="hidden min-w-0 max-w-[130px] flex-col leading-tight xl:flex">
          <span className="truncate text-[14.5px] font-semibold">{user.name}</span>
          <span className="truncate text-[12.5px] text-creaw-faint">{roleLine}</span>
        </span>
        <ChevronDown size={18} aria-hidden="true" className="hidden text-creaw-faint sm:block" />
      </button>
      {menuOpen && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-12 z-30 w-64 rounded-2xl border border-creaw-line bg-white p-1.5 shadow-xl"
        >
          <div className="mb-1 border-b border-creaw-divider px-3 pb-3 pt-2.5">
            <p className="font-semibold">{user.name}</p>
            <p className="text-[12.5px] text-creaw-faint">{user.email}</p>
          </div>
          <button type="button" className={itemClass} onClick={() => openDialog("profile")}>
            <User size={18} aria-hidden="true" className="text-creaw-faint" />
            My profile
          </button>
          {canManageUsers && (
            <Link href="/admin/users" className={itemClass} onClick={closeMenu}>
              <UserCog size={18} aria-hidden="true" className="text-creaw-faint" />
              Users &amp; roles
            </Link>
          )}
          {canViewAudit && (
            <Link href={`/audit?userId=${user.id}`} className={itemClass} onClick={closeMenu}>
              <History size={18} aria-hidden="true" className="text-creaw-faint" />
              My activity
            </Link>
          )}
          <div className="mx-1 my-1.5 h-px bg-creaw-divider" />
          <button type="button" className={itemClass} onClick={() => openDialog("sign-out")}>
            <LogOut size={18} aria-hidden="true" className="text-creaw-faint" />
            Sign out
          </button>
        </div>
      )}
      <ActionDialog
        open={dialog === "profile"}
        onClose={() => setDialog(null)}
        title="My profile"
        description="Your account details. Ask a system administrator to change them."
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-creaw-faint">Name</dt>
          <dd>{user.name}</dd>
          <dt className="text-creaw-faint">Email</dt>
          <dd>{user.email || "—"}</dd>
          <dt className="text-creaw-faint">Roles</dt>
          <dd>{user.roles.join(", ") || "—"}</dd>
        </dl>
      </ActionDialog>
      <ActionDialog
        open={dialog === "sign-out"}
        busy={signingOut}
        onClose={() => setDialog(null)}
        title="Sign out?"
        description="Sign out of the MERL Portal on this device? Unsaved changes will be lost."
        error={error}
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={signingOut} onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button disabled={signingOut} onClick={() => void signOut()}>
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </ActionDialog>
    </div>
  );
}
