"use client";
import { useState } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { hasModulePermission, type EffectiveGrant } from "@/lib/auth/grants";
import { GlobalSearch, type SearchDestination } from "./global-search";
import { Button } from "@/components/ui/button";
import type { NavigationStatus } from "./navigation";
import { NotificationsMenu } from "./notifications-menu";
import { UserMenu } from "./user-menu";

export function PortalHeader({
  user,
  collapsed,
  onToggleSidebar,
  onOpenMobile,
  quarter,
  onQuarterChange,
  destinations,
  grants,
  status,
}: {
  user: SessionUser;
  grants: readonly EffectiveGrant[];
  status?: NavigationStatus;
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
  quarter: string;
  onQuarterChange: (quarter: string) => void;
  destinations: readonly SearchDestination[];
}) {
  const [year] = useState(() => Number(quarter.slice(0, 4)));
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
        <NotificationsMenu status={status} />
        <UserMenu
          user={user}
          canManageUsers={hasModulePermission(grants, "USER_MANAGE")}
          canViewAudit={hasModulePermission(grants, "AUDIT_LOG_VIEW")}
        />
      </div>
    </header>
  );
}
