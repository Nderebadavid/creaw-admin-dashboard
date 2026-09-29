"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDownIcon, LogOutIcon, SettingsIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCurrentUser, useRoleSwitcher } from "@/lib/auth/current-role";
import { logoutAction } from "@/lib/auth/actions";
import { ALL_ROLES, type UserRole } from "@/types/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./theme-toggle";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card";

export function Header() {
  const router = useRouter();
  const { role, setRole } = useRoleSwitcher();
  const user = useCurrentUser();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logoutAction();
    } finally {
      router.push("/login");
    }
  };

  return (
    <header
      className={cn(
        // Flush bar like rental-v1-app's NavHeader -- full width, pinned to
        // the top, square corners, just a bottom border to separate it.
        "flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6 py-3 shadow-sm",
        // Clears the fixed mobile hamburger (left-4, 40px wide + gap).
        "pl-20 md:pl-6"
      )}
    >
      <h1 className="truncate text-lg font-semibold text-foreground">
        Welcome, {user.firstName}
      </h1>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <span className="hidden rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium capitalize text-primary sm:inline-flex">
          {role.replace("_", " ")}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Account menu"
                className={cn(
                  "flex items-center gap-1.5 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-accent",
                  focusRing
                )}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {user.initials}
                </span>
                <ChevronDownIcon
                  size={14}
                  className="hidden text-muted-foreground sm:block"
                />
              </button>
            }
          />

          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="px-2 py-2">
              <p className="truncate text-sm font-semibold text-foreground">
                {user.name}
              </p>
              <p className="truncate text-xs font-normal text-muted-foreground">
                {user.email}
              </p>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuLabel>Preview role</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={role}
              onValueChange={(value) => setRole(value as UserRole)}
            >
              {ALL_ROLES.map((r) => (
                <DropdownMenuRadioItem key={r} value={r} className="capitalize">
                  {r.replace("_", " ")}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              render={
                <Link href="/settings">
                  <SettingsIcon />
                  Settings
                </Link>
              }
            />
            <DropdownMenuItem
              variant="destructive"
              disabled={signingOut}
              closeOnClick={false}
              onClick={handleSignOut}
            >
              <LogOutIcon />
              {signingOut ? "Signing out..." : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
