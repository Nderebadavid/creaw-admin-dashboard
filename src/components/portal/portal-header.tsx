"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Menu, PanelLeftClose, PanelLeftOpen, ChevronDown } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";
import { GlobalSearch, type SearchDestination } from "./global-search";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function PortalHeader({
  user,
  collapsed,
  onToggleSidebar,
  onOpenMobile,
  quarter,
  onQuarterChange,
  destinations,
}: {
  user: SessionUser;
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
  quarter: string;
  onQuarterChange: (quarter: string) => void;
  destinations: readonly SearchDestination[];
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(false),
    [signingOut, setSigningOut] = useState(false),
    [error, setError] = useState("");
  const [year] = useState(() => Number(quarter.slice(0, 4)));
  async function signOut() {
    setSigningOut(true);
    setError("");
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
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-white px-4 py-3 lg:flex-nowrap lg:px-7">
      <Button
        variant="outline"
        size="icon"
        aria-label="Open navigation"
        onClick={onOpenMobile}
        className="lg:hidden"
      >
        <Menu aria-hidden="true" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={onToggleSidebar}
        className="hidden lg:inline-flex"
      >
        {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
      </Button>
      <div className="order-last flex w-full lg:order-none lg:max-w-md lg:flex-1">
        <GlobalSearch destinations={destinations} />
      </div>
      <div className="ml-auto flex items-center gap-3">
        <label className="sr-only" htmlFor="reporting-quarter">
          Reporting quarter
        </label>
        <select
          id="reporting-quarter"
          value={quarter}
          onChange={(event) => onQuarterChange(event.target.value)}
          className="h-11 max-w-40 rounded-xl border bg-white px-2 text-sm font-semibold"
        >
          {[year, year - 1].flatMap((y) =>
            [4, 3, 2, 1].map((q) => (
              <option key={`${y}-Q${q}`} value={`${y}-Q${q}`}>
                Q{q} {y} ({["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"][q - 1]})
              </option>
            ))
          )}
        </select>
        <Button
          variant="outline"
          size="icon"
          aria-label="Notifications"
          onClick={() => setNotifications(true)}
          className="rounded-full"
        >
          <Bell aria-hidden="true" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Account for ${user.name}`}
            disabled={signingOut}
            className="flex items-center gap-3 rounded-lg p-1 text-left"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
              {user.initials}
            </span>
            <span className="hidden xl:block">
              <span className="block text-sm font-semibold">{user.name}</span>
              <span className="block text-xs text-creaw-muted">CREAW MERL Portal</span>
            </span>
            <ChevronDown size={16} aria-hidden="true" className="hidden sm:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-2 py-2 text-sm">
              <p className="font-semibold">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Dialog open={notifications} onOpenChange={setNotifications}>
        <DialogContent>
          <DialogTitle>Notifications</DialogTitle>
          <DialogDescription>No new notifications.</DialogDescription>
        </DialogContent>
      </Dialog>
    </header>
  );
}
