"use client";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { hasModulePermission, type EffectiveGrant } from "@/lib/auth/grants";
import { GlobalSearch, type SearchDestination } from "./global-search";
import { Button } from "@/components/ui/button";
import type { NavigationStatus } from "./navigation";
import { NotificationsMenu } from "./notifications-menu";
import { UserMenu } from "./user-menu";
import { DateRangePicker, type DateRange } from "./date-range-picker";

export function PortalHeader({
  user,
  collapsed,
  onToggleSidebar,
  onOpenMobile,
  range,
  onRangeChange,
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
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  destinations: readonly SearchDestination[];
}) {
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
        <DateRangePicker value={range} onChange={onRangeChange} />
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
