import Image from "next/image";
import Link from "next/link";
import type { EffectiveGrant } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { permittedNavigation, type NavigationStatus } from "./navigation";

export interface PortalSidebarProps {
  grants: readonly EffectiveGrant[];
  pathname: string;
  collapsed?: boolean;
  availableRoutes?: readonly string[];
  /** Waiting-work counts for badges and the reporting-window card. */
  status?: NavigationStatus;
  /** Reference date for the reporting window; defaults to now (tests pin it). */
  today?: Date;
  onNavigate?: () => void;
}

/** The current quarter and its last day, e.g. `{ quarter: "Q3", deadline: "30 Sep" }`. */
function reportingWindow(today: Date) {
  const quarter = Math.floor(today.getMonth() / 3) + 1;
  const lastDay = new Date(today.getFullYear(), quarter * 3, 0);
  // Fixed names: some ICU builds abbreviate September as "Sept".
  const month = ["Mar", "Jun", "Sep", "Dec"][quarter - 1];
  return { quarter: `Q${quarter}`, deadline: `${lastDay.getDate()} ${month}` };
}

export function PortalSidebar({
  grants,
  pathname,
  collapsed = false,
  availableRoutes,
  status,
  today = new Date(),
  onNavigate,
}: PortalSidebarProps) {
  const groups = permittedNavigation(grants, availableRoutes);
  const showsCalendar = groups.some((group) =>
    group.items.some((item) => item.href === "/reporting")
  );
  const window = reportingWindow(today);
  const overdue = status?.overdueReports ?? 0;

  return (
    <div className="flex h-full flex-col bg-white">
      <div
        className={cn(
          "mb-1.5 flex items-center justify-center border-b border-[#F0DFC8] bg-[#FDF6EC]",
          collapsed ? "px-0 py-3.5" : "px-5 py-4"
        )}
      >
        {collapsed ? (
          <span
            aria-label="CREAW MERL Portal"
            className="flex size-11 items-center justify-center rounded-xl bg-primary font-heading text-2xl font-bold text-white shadow-[inset_0_-3px_0_#F2B25C]"
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
        className={cn("flex-1 space-y-5 overflow-y-auto px-3.5 pb-5 pt-2.5", collapsed && "px-2")}
      >
        {groups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h2
              className={cn(
                "px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-[#A39A92]",
                collapsed && "sr-only"
              )}
            >
              {group.label}
            </h2>
            {collapsed && <div aria-hidden="true" className="mx-2.5 mb-2 h-px bg-creaw-divider" />}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const waiting = item.badge ? (status?.[item.badge] ?? 0) : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.label}
                      aria-label={waiting ? `${item.label}, ${waiting} waiting` : undefined}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex min-h-10 items-center gap-3 rounded-[10px] px-3 py-2 text-[14.5px] font-semibold text-creaw-ink-soft hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary",
                        active && "bg-creaw-orange-soft text-primary",
                        collapsed && "justify-center px-2"
                      )}
                    >
                      <item.icon
                        aria-hidden="true"
                        size={20}
                        className="shrink-0"
                        style={{ color: item.color ?? (active ? undefined : "#8A8078") }}
                      />
                      <span className={collapsed ? "sr-only" : "flex-1 whitespace-nowrap"}>
                        {item.label}
                      </span>
                      {waiting > 0 &&
                        (collapsed ? (
                          <span
                            aria-hidden="true"
                            className="absolute right-3 top-1.5 size-[7px] rounded-full bg-[#E0822F]"
                          />
                        ) : (
                          <span className="rounded-full bg-[#FDEFD9] px-2 py-0.5 text-[11px] font-bold text-[#9A5A0E]">
                            {waiting}
                          </span>
                        ))}
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
      {showsCalendar && !collapsed && (
        <div className="mx-4 mb-5 mt-auto flex flex-col gap-1.5 rounded-[14px] bg-[#FDF3E3] p-[18px]">
          <p className="font-heading text-lg font-bold text-[#8C3F20]">
            {window.quarter} reporting window
          </p>
          <p className="text-[13px] leading-snug text-[#6B5A4C]">
            {overdue} donor report{overdue === 1 ? "" : "s"} overdue. Submit before{" "}
            {window.deadline} to stay compliant.
          </p>
          <Link
            href="/reporting"
            onClick={onNavigate}
            className="mt-1.5 self-start rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#8C3F20]"
          >
            Review calendar
          </Link>
        </div>
      )}
    </div>
  );
}
