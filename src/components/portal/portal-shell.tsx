"use client";
import { Suspense, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Session } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PortalSidebar } from "./portal-sidebar";
import { PortalHeader } from "./portal-header";
import { PageTitleProvider } from "./page-title";
import type { NavigationStatus } from "./navigation";
import { DashboardRange } from "./dashboard-range";
import { PortalNavigationProvider } from "./portal-navigation";

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
    [mobileOpen, setMobileOpen] = useState(false);
  const sidebarProps = { grants: session.grants, pathname, availableRoutes, status };
  return (
    <PageTitleProvider>
      <PortalNavigationProvider>
        {(pending) => (
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
                // The period picker applies to the dashboard only; other pages have no period.
                range={
                  pathname === "/dashboard" ? (
                    <Suspense fallback={null}>
                      <DashboardRange />
                    </Suspense>
                  ) : null
                }
                grants={session.grants}
                status={status}
              />
              {pending && (
                <div
                  role="status"
                  className="fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden bg-[#F4E3D3]"
                >
                  <span className="sr-only">Updating…</span>
                  <div className="h-full w-1/3 animate-[portal-progress_1.1s_ease-in-out_infinite] bg-primary" />
                </div>
              )}
              <main
                id="portal-content"
                tabIndex={-1}
                aria-busy={pending}
                className={cn(
                  "mx-auto max-w-[1800px] px-4 pb-24 pt-4 outline-none transition-opacity md:px-7 md:pt-[26px]",
                  pending && "pointer-events-none opacity-60"
                )}
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
        )}
      </PortalNavigationProvider>
    </PageTitleProvider>
  );
}
