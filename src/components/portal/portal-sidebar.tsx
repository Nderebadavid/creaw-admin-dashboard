import Image from "next/image";
import Link from "next/link";
import type { EffectiveGrant } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { permittedNavigation } from "./navigation";

export interface PortalSidebarProps {
  grants: readonly EffectiveGrant[];
  pathname: string;
  collapsed?: boolean;
  availableRoutes?: readonly string[];
  onNavigate?: () => void;
}
export function PortalSidebar({
  grants,
  pathname,
  collapsed = false,
  availableRoutes,
  onNavigate,
}: PortalSidebarProps) {
  const groups = permittedNavigation(grants, availableRoutes);
  return (
    <div className="flex h-full flex-col bg-white">
      <div className={cn("flex h-32 items-center px-7", collapsed && "h-20 justify-center px-2")}>
        {collapsed ? (
          <span
            aria-label="CREAW MERL Portal"
            className="rounded-xl bg-primary px-3 py-1 font-heading text-3xl font-bold text-white"
          >
            C
          </span>
        ) : (
          <Image
            src="/creaw-logo.png"
            alt="CREAW — Centre for Rights Education and Awareness"
            width={657}
            height={465}
            sizes="120px"
            style={{ width: 120, height: "auto" }}
            preload
          />
        )}
      </div>
      <nav
        aria-label="Main navigation"
        className={cn("flex-1 space-y-6 overflow-y-auto px-3 pb-6", collapsed && "px-2")}
      >
        {groups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h2
              className={cn(
                "px-3 pb-2 text-[11px] font-semibold uppercase tracking-[.12em] text-creaw-muted",
                collapsed && "sr-only"
              )}
            >
              {group.label}
            </h2>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.label}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-creaw-ink-soft hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary",
                        active && "bg-creaw-orange-soft text-primary",
                        collapsed && "justify-center px-2"
                      )}
                    >
                      <item.icon
                        aria-hidden="true"
                        size={20}
                        className="shrink-0"
                        style={{ color: item.color }}
                      />
                      <span className={collapsed ? "sr-only" : ""}>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {!groups.length && (
          <p className="px-3 text-sm text-muted-foreground">No accessible pages.</p>
        )}
      </nav>
    </div>
  );
}
