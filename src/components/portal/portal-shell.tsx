"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Session } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PortalSidebar } from "./portal-sidebar";
import { PortalHeader } from "./portal-header";
import { permittedNavigation, type NavigationStatus } from "./navigation";

const PortalPeriodContext = createContext<{
  quarter: string;
  setQuarter: (value: string) => void;
} | null>(null);
export function usePortalPeriod() {
  const context = useContext(PortalPeriodContext);
  if (!context) throw new Error("usePortalPeriod requires PortalShell");
  return context;
}
export function PortalShell({
  session,
  children,
  availableRoutes,
  status,
  initialQuarter = "2026-Q3",
}: {
  session: Session;
  children: ReactNode;
  availableRoutes?: readonly string[];
  /** Waiting-work counts for sidebar badges and notifications. */
  status?: NavigationStatus;
  initialQuarter?: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false),
    [mobileOpen, setMobileOpen] = useState(false),
    [quarter, setQuarter] = useState(initialQuarter);
  const sidebarProps = { grants: session.grants, pathname, availableRoutes, status };
  const destinations = permittedNavigation(session.grants, availableRoutes).flatMap((group) =>
    group.items.map((item) => ({ label: item.label, href: item.href }))
  );
  return (
    <PortalPeriodContext.Provider value={{ quarter, setQuarter }}>
      <div className="flex min-h-screen bg-background">
        <a
          href="#portal-content"
          className="sr-only fixed left-3 top-3 z-[100] rounded bg-white p-3 text-primary focus:not-sr-only"
        >
          Skip to content
        </a>
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 border-r lg:block",
            collapsed ? "w-[76px]" : "w-[248px]"
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
            quarter={quarter}
            onQuarterChange={setQuarter}
            destinations={destinations}
          />
          <main
            id="portal-content"
            tabIndex={-1}
            className="mx-auto max-w-[1800px] p-4 outline-none md:p-7"
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
    </PortalPeriodContext.Provider>
  );
}
