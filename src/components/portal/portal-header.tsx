"use client";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { hasPermission, type EffectiveGrant } from "@/lib/auth/grants";
import { useHeaderTitle } from "./page-title";
import { Button } from "@/components/ui/button";
import type { NavigationStatus } from "./navigation";
import { NotificationsMenu } from "./notifications-menu";
import { UserMenu } from "./user-menu";
import { pillarLook } from "./pillars";

/** "System-wide" for any unscoped grant, otherwise the pillars the grants cover. */
function scopeOf(grants: readonly EffectiveGrant[]) {
  if (grants.some((grant) => grant.pillarId === null)) return "System-wide";
  const pillars = [...new Set(grants.map((grant) => grant.pillarId))];
  return pillars.map((id) => pillarLook(id)?.name ?? `Pillar #${id}`).join(", ") || "—";
}

export function PortalHeader({
  user,
  collapsed,
  onToggleSidebar,
  onOpenMobile,
  grants,
  status,
}: {
  user: SessionUser;
  grants: readonly EffectiveGrant[];
  status?: NavigationStatus;
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
}) {
  const title = useHeaderTitle();
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3.5 border-b border-[#F0DFC8] bg-[#FDF6EC] px-4 py-3 lg:flex-nowrap lg:px-7">
      <Button
        variant="outline"
        size="icon"
        aria-label="Open navigation"
        onClick={onOpenMobile}
        className="border-creaw-line lg:hidden"
      >
        <Menu aria-hidden="true" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={onToggleSidebar}
        className="hidden border-creaw-line lg:inline-flex"
      >
        {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
      </Button>
      <p className="min-w-0 flex-1 truncate font-heading text-xl font-bold lg:text-2xl">{title}</p>
      <div className="flex items-center gap-3">
        <NotificationsMenu status={status} />
        <UserMenu
          user={user}
          // /admin/users and /audit require platform-wide grants.
          canManageUsers={hasPermission(grants, "USER_MANAGE")}
          canViewAudit={hasPermission(grants, "AUDIT_LOG_VIEW")}
          scope={scopeOf(grants)}
        />
      </div>
    </header>
  );
}
