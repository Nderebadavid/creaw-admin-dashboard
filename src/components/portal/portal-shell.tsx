"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Session } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PortalSidebar } from "./portal-sidebar";
import { PortalHeader } from "./portal-header";
import { permittedNavigation, type NavigationStatus } from "./navigation";
import { defaultRange, type DateRange } from "./date-range-picker";

/** The header's created-date range, shared with pages that filter by it. */
const PortalDateRangeContext = createContext<{
  range: DateRange;
  setRange: (value: DateRange) => void;
} | null>(null);
export function usePortalDateRange() {
  const context = useContext(PortalDateRangeContext);
  if (!context) throw new Error("usePortalDateRange requires PortalShell");
  return context;
}
export function PortalShell({
  session,
  children,
  availableRoutes,
  status,
}: {
  session: Session;
  children: ReactNode;
  availableRoutes?: readonly string[];
  /** Waiting-work counts for sidebar badges and notifications. */
  status?: NavigationStatus;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false),
    [mobileOpen, setMobileOpen] = useState(false),
    [range, setRange] = useState(() => defaultRange(new Date()));
  const sidebarProps = { grants: session.grants, pathname, availableRoutes, status };
  const destinations = permittedNavigation(session.grants, availableRoutes).flatMap((group) =>
    group.items.map((item) => ({ label: item.label, href: item.href }))
  );
  return (
    <PortalDateRangeContext.Provider value={{ range, setRange }}>
      <div className="flex min-h-screen bg-background">
        <a
          href="#portal-content"
          className="sr-only fixed left-3 top-3 z-[100] rounded bg-white p-3 text-primary focus:not-sr-only"
        >
          Skip to content
        </a>
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 border-r border-creaw-line transition-[width] duration-200 lg:block",
            collapsed ? "w-[84px]" : "w-[264px]"
          )}
        >
          <PortalSidebar {...sidebarProps} collapsed={collapsed} />
        </aside>
        <div className="min-w-0 flex-1">
          <PortalHeader
            user={session.user}
            collapsed={collapsed}
            onToggleSidebar={() => setCollapsed((value) => !value)}
            onOpenMobile={() => setMobileOpen(true)}
            range={range}
            onRangeChange={setRange}
            destinations={destinations}
            grants={session.grants}
            status={status}
          />
          <main
            id="portal-content"
            tabIndex={-1}
            className="mx-auto max-w-[1800px] px-4 pb-24 pt-4 outline-none md:px-7 md:pt-[26px]"
          >
            {children}
          </main>
        </div>
        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogContent className="left-0 top-0 h-dvh w-[280px] max-w-[90vw] translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none p-0 sm:max-w-[280px]">
            <DialogTitle className="sr-only">Navigation</DialogTitle>
            <DialogDescription className="sr-only">CREAW portal navigation</DialogDescription>
            <PortalSidebar {...sidebarProps} onNavigate={() => setMobileOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    </PortalDateRangeContext.Provider>
  );
}
